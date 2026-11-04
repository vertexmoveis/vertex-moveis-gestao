/* eslint-disable @typescript-eslint/no-require-imports -- Uses the tsx CommonJS hook. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// Run with: node --require tsx/cjs tests/integration-quote-conversion-service.cjs
// Never inherit the application's configured database or load an .env file.
const databaseUrl = process.env.CONVERSION_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('CONVERSION_TEST_DATABASE_URL is required');
const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedDatabaseUrl.pathname.slice(1));
const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsedDatabaseUrl.hostname);
const testDatabase = databaseName === 'vertex_conversion_ci'
  || (databaseName === 'postgres' && parsedDatabaseUrl.port === '55449');
const allowedParameters = ['schema', 'connection_limit', 'pool_timeout', 'connect_timeout', 'pgbouncer'];
const safeParameters = [...parsedDatabaseUrl.searchParams.keys()].every((key) => allowedParameters.includes(key));
if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol) || !loopback || !testDatabase || !safeParameters) {
  throw new Error('Conversion integration tests require a loopback vertex_conversion_ci database (or local PGlite on port 55449)');
}
const { PrismaClient } = require('@prisma/client');
const { convertApprovedQuote } = require('../lib/quote-conversion.ts');
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const prefix = 'conversion-service-local-' + crypto.randomUUID();
const rollback = new Error('ROLL_BACK_SYNTHETIC_TEST');
const checks = [];
(async () => {
  try {
    await db.$transaction(async (tx) => {
      const owner = await tx.user.create({ data: { email: prefix + '@example.invalid', name: 'Synthetic owner', password: 'not-a-login', role: 'MANAGER' } });
      const other = await tx.user.create({ data: { email: prefix + '-other@example.invalid', name: 'Synthetic other', password: 'not-a-login', role: 'MANAGER' } });
      const admin = await tx.user.create({ data: { email: prefix + '-admin@example.invalid', name: 'Synthetic admin', password: 'not-a-login', role: 'ADMIN' } });
      const client = await tx.client.create({ data: { name: prefix, managerId: owner.id } });
      const materialName = prefix + '-MDF';
      const material = await tx.materialCatalogItem.create({ data: { name: materialName, unit: 'm2', stockQuantity: 5 } });
      const existingProject = await tx.project.create({ data: { name: prefix + '-reservation', clientId: client.id, managerId: owner.id } });
      await tx.inventoryReservation.create({ data: { materialId: material.id, projectId: existingProject.id, quantity: 2 } });
      const approvedAt = new Date('2026-10-25T15:00:00Z');
      const soldAt = new Date('2026-11-04T15:00:00Z');
      async function fixture(overrides = {}, proof = true, invalidated = false) {
        const group = overrides.groupId ? {id: overrides.groupId} : await tx.quoteGroup.create({ data: { title: prefix, clientId: client.id, createdById: owner.id } });
        return tx.quote.create({ data: {
          groupId: group.id, clientId: client.id, createdById: owner.id,
          title: prefix, status: 'APPROVED', approvedAt, paymentMethod: 'BOLETO', total: 18500,
          costTotal: 7250, cardDownPayment: 5000, cardInstallments: 3, firstInstallmentDate: new Date('2026-12-10T12:00:00Z'),
          paymentDiscount: 150, cardFeePercent: 2, cardFeeAmount: 270, deliveryBusinessDays: 30,
          ...overrides,
          approvalRequests: proof ? { create: { token: crypto.randomUUID(), approvedAt, invalidatedAt: invalidated ? approvedAt : null, snapshot: 'Synthetic local approval fixture' } } : undefined,
          items: { create: [
            { environment: 'Cozinha', environmentName: 'Cozinha', description: 'Balcao teste', placement: 'Parede A', sourceItemKey: 'a', material: materialName, finish: 'Branco TX', width: 100, height: 200, areaM2: 2, quantity: 1, cost: 2250, total: 6500, position: 1 },
            { environment: 'Sala', environmentName: 'Sala', description: 'Painel teste', placement: 'Parede B', sourceItemKey: 'b', material: materialName, finish: 'Madeirado', width: 200, height: 200, areaM2: 4, quantity: 1, cost: 5000, total: 12000, position: 2 },
          ] },
        } });
      }
      const quote = await fixture();
      const proofBefore = await tx.quoteApprovalRequest.findMany({ where: { quoteId: quote.id } });
      const result = await convertApprovedQuote(tx, { quoteId: quote.id, user: owner, soldAt, downPaymentDueDate: '2026-11-08' });
      assert.deepEqual(Object.keys(result).sort(), ['id','name']);
      const project = await tx.project.findUniqueOrThrow({ where: {id: result.id}, include: { payments: { orderBy: {installmentNumber:'asc'} }, environments: {orderBy:{position:'asc'}}, materials: true, checklist:true, inventoryReservations:true, timeline:true, activities:true, contracts:true, financeReceipts:true } });
      const soldQuote = await tx.quote.findUniqueOrThrow({where:{id:quote.id}});
      assert.equal(soldQuote.status, 'SOLD'); assert.equal(soldQuote.convertedProjectId, project.id); assert.equal(soldQuote.soldAt.toISOString(), soldAt.toISOString()); assert.equal(soldQuote.approvedAt.toISOString(), approvedAt.toISOString());
      assert.equal(project.name, quote.title); assert.equal(project.managerId,owner.id); assert.equal(Number(project.value),18500); assert.equal(Number(project.productionCost),7250);
      assert.equal(project.paymentMethod,'BOLETO'); assert.equal(Number(project.paymentDiscount),150); assert.equal(project.cardFeePercent,2); assert.equal(Number(project.cardFeeAmount),270);
      assert.equal(project.status,'APPROVED'); assert.equal(project.stage,'PENDING_START'); assert.equal(project.initialPaymentRequired,true); assert.equal(project.paymentConfirmedAt,null); assert.equal(project.startDate,null); assert.equal(project.deliveryDeadlineDate,null); assert.equal(project.estimatedEndDate,null); assert.equal(project.productionStartReminderDate,null);
      assert.equal(project.downPaymentDate.toISOString(), '2026-11-08T12:00:00.000Z'); assert.equal(project.approvalDate.toISOString(),approvedAt.toISOString());
      assert.equal(project.payments.length,4); assert.deepEqual(project.payments.map(p=>Number(p.amount)),[5000,4500,4500,4500]); assert.ok(project.payments.every(p=>p.paidAt===null && p.paymentMethod===null)); assert.equal(project.payments[0].dueDate.toISOString(),'2026-11-08T12:00:00.000Z'); assert.equal(project.payments[1].dueDate.toISOString(),'2026-12-10T12:00:00.000Z');
      assert.equal(await tx.paymentHistory.count({where:{payment:{projectId:project.id}}}),0); assert.equal(project.financeReceipts.length,0); assert.equal(project.contracts.length,0); assert.equal(project.technicalApprovedAt,null);
      assert.deepEqual(project.environments.map(e=>e.name),['Cozinha','Sala']); assert.ok(project.environments.every(e=>e.status==='PENDING' && e.mdfSpecifications.length===2)); assert.equal(project.materials.length,2); assert.equal(project.materials.reduce((n,m)=>n+Number(m.estimatedCost),0),7250); assert.ok(project.materials.every(m=>m.status==='PENDING' && m.materialId===material.id)); assert.ok(project.checklist.length>0);
      assert.equal(project.inventoryReservations.length,1); assert.equal(project.inventoryReservations[0].quantity,3); assert.equal(Number((await tx.materialCatalogItem.findUniqueOrThrow({where:{id:material.id}})).stockQuantity),5);
      assert.ok(project.timeline.some(e=>e.event==='Projeto criado do orçamento' && e.description.includes(owner.name))); assert.ok(project.timeline.some(e=>e.event==='Materiais reservados no estoque')); assert.equal(project.activities.length,1); assert.equal(project.activities[0].userId,owner.id);
      assert.deepEqual(await tx.quoteApprovalRequest.findMany({where:{quoteId:quote.id}}),proofBefore);
      const updatedClient = await tx.client.findUniqueOrThrow({where:{id:client.id}}); assert.equal(updatedClient.relationshipStage,'CUSTOMER'); assert.equal(updatedClient.lastCommercialActivityAt.toISOString(),soldAt.toISOString());
      checks.push('approved BOLETO creates complete project, SOLD link/date, unpaid schedule, environments/checklist/costs, capped reservation, timeline/activity/client stage; proof untouched; no receipts/signatures');
      async function rejected(q, user, expected) { const before = await tx.project.count({where:{name:prefix}}); await assert.rejects(convertApprovedQuote(tx,{quoteId:q.id,user,soldAt}),new RegExp('^Error: '+expected+'$')); assert.equal(await tx.project.count({where:{name:prefix}}),before); assert.equal((await tx.quote.findUniqueOrThrow({where:{id:q.id}})).convertedProjectId,q.convertedProjectId); checks.push(expected); }
      await rejected(quote,owner,'ALREADY_CONVERTED');
      await rejected(await fixture({groupId:quote.groupId,variationOrder:1}),owner,'ALREADY_CONVERTED');
      await rejected(await fixture(),other,'FORBIDDEN');
      await rejected(await fixture(),{id:owner.id,role:'VIEWER'},'FORBIDDEN');
      await rejected(await fixture({status:'DRAFT'}),owner,'NOT_APPROVED');
      await rejected(await fixture({approvedAt:null}),owner,'NOT_APPROVED');
      await rejected(await fixture({},false),owner,'APPROVAL_PROOF_REQUIRED');
      await rejected(await fixture({},true,true),owner,'APPROVAL_PROOF_REQUIRED');
      await rejected(await fixture({paymentMethod:'TO_DEFINE'}),owner,'PAYMENT_TERMS_REQUIRED');
      await rejected(await fixture({cardInstallments:0}),owner,'INSTALLMENTS_REQUIRED');
      await rejected(await fixture({firstInstallmentDate:null}),owner,'FIRST_INSTALLMENT_REQUIRED');
      await rejected(await fixture({archivedAt:new Date()}),owner,'NOT_FOUND');
      await assert.rejects(convertApprovedQuote(tx,{quoteId:'nonexistent-'+prefix,user:admin,soldAt}),/^Error: NOT_FOUND$/); checks.push('NOT_FOUND missing');
      const pixQuote = await fixture({paymentMethod:'PIX',cardDownPayment:0,cardInstallments:0,firstInstallmentDate:null});
      const pixResult = await convertApprovedQuote(tx,{quoteId:pixQuote.id,user:{id:admin.id,role:admin.role},soldAt:new Date('2026-11-04T01:00:00Z')});
      const pix = await tx.project.findUniqueOrThrow({where:{id:pixResult.id},include:{payments:true,timeline:true}});
      assert.equal(pix.managerId,owner.id); assert.equal(pix.payments.length,1); assert.equal(Number(pix.payments[0].amount),18500); assert.equal(pix.payments[0].paidAt,null); assert.equal(pix.payments[0].dueDate.toISOString(),'2026-11-03T12:00:00.000Z'); assert.equal(pix.paymentConfirmedAt,null); assert.equal(pix.deliveryDeadlineDate,null); assert.ok(pix.timeline.some(e=>e.description.includes(admin.id))); checks.push('PIX full value remains unpaid; ADMIN preserves quote owner; fallback due date uses Sao Paulo day and actor id');
      const noEntryQuote=await fixture({cardDownPayment:0});
      const noEntryResult=await convertApprovedQuote(tx,{quoteId:noEntryQuote.id,user:owner,soldAt});
      const noEntry=await tx.project.findUniqueOrThrow({where:{id:noEntryResult.id},include:{payments:true}});
      assert.equal(noEntry.initialPaymentRequired,false); assert.equal(noEntry.paymentConfirmedAt,null); assert.equal(noEntry.startDate,null); assert.ok(noEntry.deliveryDeadlineDate instanceof Date); assert.ok(noEntry.productionStartReminderDate instanceof Date); assert.ok(noEntry.payments.every(p=>p.paidAt===null)); checks.push('zero-entry installment production dates preserved and all payments unpaid');
      throw rollback;
    },{isolationLevel:'Serializable',timeout:60000,maxWait:30000});
  } catch(error) { if(error!==rollback) throw error; }
  assert.equal(await db.user.count({where:{email:{startsWith:prefix}}}),0); assert.equal(await db.client.count({where:{name:prefix}}),0); assert.equal(await db.project.count({where:{name:{startsWith:prefix}}}),0);
  console.log(JSON.stringify({passed:true,checks,rolledBack:true}));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>db.$disconnect());
