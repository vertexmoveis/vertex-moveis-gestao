import { randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

function randomPassword() {
  return randomBytes(24).toString('base64url')
}

export async function POST(req: NextRequest) {
  const seedToken = process.env.SEED_TOKEN
  const requestedToken = req.headers.get('x-seed-token')

  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.ALLOW_SEED !== 'true' ||
    !seedToken ||
    requestedToken !== seedToken
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@vertexmoveis.com.br' },
    })

    if (existingAdmin) {
      return NextResponse.json({ message: 'Dados ja existem', alreadySeeded: true })
    }

    const admin = await prisma.user.create({
      data: {
        name: 'Admin Vertex',
        email: 'admin@vertexmoveis.com.br',
        password: await bcrypt.hash(randomPassword(), 12),
        role: 'ADMIN',
      },
    })

    const manager1 = await prisma.user.create({
      data: {
        name: 'Carlos Silva',
        email: 'carlos@vertexmoveis.com.br',
        password: await bcrypt.hash(randomPassword(), 12),
        role: 'MANAGER',
      },
    })

    const manager2 = await prisma.user.create({
      data: {
        name: 'Ana Rodrigues',
        email: 'ana@vertexmoveis.com.br',
        password: await bcrypt.hash(randomPassword(), 12),
        role: 'MANAGER',
      },
    })

    const clientsData = [
      { name: 'Roberto Almeida', phone: '(11) 98765-4321', whatsapp: '(11) 98765-4321', email: 'roberto.almeida@email.com', address: 'Rua das Flores, 123 - Vila Olimpia, SP', notes: 'Cliente VIP, prefere WhatsApp' },
      { name: 'Fernanda Costa', phone: '(11) 97654-3210', whatsapp: '(11) 97654-3210', email: 'fernanda.costa@gmail.com', address: 'Av. Brigadeiro Faria Lima, 1500 - Itaim, SP' },
      { name: 'Marcos Pereira', phone: '(11) 96543-2109', whatsapp: '(11) 96543-2109', email: 'marcos.pereira@empresa.com', address: 'Rua Oscar Freire, 800 - Jardins, SP', notes: 'Projeto comercial - escritorio' },
      { name: 'Juliana Santos', phone: '(11) 95432-1098', whatsapp: '(11) 95432-1098', email: 'juliana.santos@email.com', address: 'Rua Pamplona, 200 - Bela Vista, SP' },
      { name: 'Ricardo Oliveira', phone: '(11) 94321-0987', whatsapp: '(11) 94321-0987', email: 'ricardo.oliveira@hotmail.com', address: 'Alameda Santos, 45 - Cerqueira Cesar, SP', notes: 'Segunda compra, cliente fidelizado' },
      { name: 'Patricia Lima', phone: '(11) 93210-9876', whatsapp: '(11) 93210-9876', email: 'patricia.lima@email.com', address: 'Rua Haddock Lobo, 55 - Cerqueira Cesar, SP' },
      { name: 'Eduardo Martins', phone: '(11) 92109-8765', whatsapp: '(11) 92109-8765', email: 'eduardo.martins@empresa.com.br', address: 'Av. Paulista, 2300 - Bela Vista, SP', notes: 'Projeto residencial - apartamento novo' },
    ]

    const clients = await Promise.all(clientsData.map((client) => prisma.client.create({ data: client })))
    const now = new Date()
    const days = (n: number) => new Date(now.getTime() + n * 86400000)

    const projectsData = [
      { clientId: clients[0].id, managerId: manager1.id, name: 'Cozinha Completa', room: 'Cozinha', status: 'IN_PRODUCTION', stage: 'PRODUCTION', startDate: days(-30), estimatedEndDate: days(15), value: 28500, internalNotes: 'Madeira Freijo com puxadores dourados' },
      { clientId: clients[0].id, managerId: manager1.id, name: 'Home Office', room: 'Escritorio', status: 'DESIGN_ENGINEERING', stage: 'DESIGN', startDate: days(-10), estimatedEndDate: days(30), value: 12000 },
      { clientId: clients[1].id, managerId: manager2.id, name: 'Closet Master', room: 'Quarto Master', status: 'APPROVED', stage: 'PENDING_START', startDate: days(5), estimatedEndDate: days(45), value: 35000, internalNotes: 'Closet com ilha central e espelho' },
      { clientId: clients[2].id, managerId: manager1.id, name: 'Escritorio Corporativo', room: 'Escritorio', status: 'INSTALLATION_SCHEDULED', stage: 'INSTALLATION', startDate: days(-60), estimatedEndDate: days(3), value: 85000, internalNotes: '15 estacoes de trabalho' },
      { clientId: clients[3].id, managerId: manager2.id, name: 'Sala de Estar', room: 'Sala', status: 'COMPLETED', stage: 'COMPLETED', startDate: days(-90), estimatedEndDate: days(-15), actualEndDate: days(-14), value: 22000 },
      { clientId: clients[4].id, managerId: manager1.id, name: 'Dormitorio Casal', room: 'Quarto', status: 'DELAYED', stage: 'PRODUCTION', startDate: days(-45), estimatedEndDate: days(-5), value: 18500, internalNotes: 'Atraso - reordenar material' },
      { clientId: clients[5].id, managerId: manager2.id, name: 'Lavanderia Planejada', room: 'Lavanderia', status: 'MEASUREMENT_SCHEDULED', stage: 'MEASUREMENT', startDate: days(2), estimatedEndDate: days(35), value: 8500 },
      { clientId: clients[6].id, managerId: manager1.id, name: 'Cozinha Americana', room: 'Cozinha', status: 'IN_PRODUCTION', stage: 'PRODUCTION', startDate: days(-15), estimatedEndDate: days(20), value: 31000, internalNotes: 'Estilo contemporaneo, sem puxadores' },
      { clientId: clients[1].id, managerId: manager2.id, name: 'Banheiro Casal', room: 'Banheiro', status: 'DESIGN_ENGINEERING', stage: 'DESIGN', startDate: days(-5), estimatedEndDate: days(40), value: 9500 },
      { clientId: clients[3].id, managerId: manager1.id, name: 'Varanda Gourmet', room: 'Varanda', status: 'IN_PRODUCTION', stage: 'PRODUCTION', startDate: days(-20), estimatedEndDate: days(8), value: 16000 },
    ]

    const projects = await Promise.all(
      projectsData.map((project) =>
        prisma.project.create({ data: project as Parameters<typeof prisma.project.create>[0]['data'] })
      )
    )

    for (const project of projects) {
      await prisma.timelineEvent.createMany({
        data: [
          { projectId: project.id, event: 'Projeto Criado', description: 'Projeto cadastrado no sistema', date: project.createdAt },
          { projectId: project.id, event: 'Aprovacao', description: 'Proposta aprovada pelo cliente', date: new Date(project.createdAt.getTime() + 86400000) },
        ],
      })
    }

    await prisma.activityLog.createMany({
      data: [
        { action: 'Novo cliente cadastrado', details: 'Eduardo Martins adicionado', userId: admin.id },
        { action: 'Projeto atualizado', details: 'Cozinha Completa avancou para Producao', userId: manager1.id, projectId: projects[0].id },
        { action: 'Status alterado', details: 'Dormitorio Casal marcado como Atrasado', userId: admin.id, projectId: projects[5].id },
        { action: 'Instalacao agendada', details: 'Escritorio Corporativo - instalacao amanha', userId: manager1.id, projectId: projects[3].id },
        { action: 'Projeto concluido', details: 'Sala de Estar finalizada com sucesso', userId: manager2.id, projectId: projects[4].id },
      ],
    })

    return NextResponse.json({
      success: true,
      message: 'Dados de exemplo criados com sucesso.',
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
