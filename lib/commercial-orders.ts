import { Prisma } from '@prisma/client'

export type CommercialInput = {
  userId: string; isAdmin: boolean; query?: string; clientId?: string; ownerId?: string;
  status?: string; view?: string; attention?: string; archived?: boolean; page: number; pageSize: number; today: Date;
}

// One SQL snapshot for the mixed list, counts and pagination. An inaccessible
// linked quote never removes the request summary its assignee is allowed to see.
export function commercialOrdersQuery(input: CommercialInput) {
  const groupAccess = input.isAdmin ? Prisma.sql`TRUE` : Prisma.sql`g."createdById" = ${input.userId}`
  const requestAccess = input.isAdmin ? Prisma.sql`TRUE` : Prisma.sql`(r."createdById" = ${input.userId} OR r."assignedToId" = ${input.userId})`
  const filters = Prisma.sql`
    AND (${input.clientId || ''} = '' OR "clientId" = ${input.clientId || ''})
    AND (${input.ownerId || ''} = '' OR "ownerId" = ${input.ownerId || ''})
    AND (${input.query || ''} = '' OR "searchText" ILIKE ${`%${input.query || ''}%`})
    AND archived = ${Boolean(input.archived)}
    AND (${input.status || ''} = '' OR status = ${input.status || ''}
      OR (${input.status || ''} = 'DRAFT' AND status = 'IN_PROGRESS')
      OR (${input.status || ''} = 'MISSING_INFO' AND flag = 'Falta informação')
      OR (${input.status || ''} = 'READY' AND flag = 'Pronto para enviar'))
    AND (${input.attention || ''} = ''
      OR (${input.attention || ''} = 'missing' AND flag = 'Falta informação')
      OR (${input.attention || ''} = 'ready' AND (status = 'READY' OR flag = 'Pronto para enviar'))
      OR (${input.attention || ''} = 'late' AND deadline < ${input.today} AND status NOT IN ('SOLD','LOST','CANCELLED','READY') AND COALESCE(flag, '') <> 'Pronto para enviar')
      OR (${input.attention || ''} = 'expired' AND "deadlineKind" = 'Validade' AND deadline < ${input.today} AND status NOT IN ('SOLD','LOST','CANCELLED')))
  `
  return Prisma.sql`
    WITH orders AS (
      SELECT 'group:' || g.id AS id, g.title, g."clientId", c.name AS "clientName",
        COALESCE(r."assignedToId",g."createdById") AS "ownerId", COALESCE(ru.name,u.name,'Sem responsável') AS "ownerName",
        r.id AS "requestId", q.id AS "quoteId", CASE WHEN ${input.isAdmin} OR p."managerId" = ${input.userId} THEN p.id END AS "projectId",
        q.status, CASE WHEN q.status = 'DRAFT' AND r.id IS NOT NULL THEN r."dueDate" ELSE q."validUntil" END AS deadline,
        CASE WHEN q.status = 'DRAFT' AND r.id IS NOT NULL THEN 'Retorno' ELSE 'Validade' END AS "deadlineKind",
        GREATEST(g."updatedAt",q."updatedAt",r."updatedAt") AS "updatedAt", q.total::float8 AS amount,
        (SELECT COUNT(*)::int FROM "Quote" v WHERE v."groupId" = g.id AND (v."archivedAt" IS NULL) = (q."archivedAt" IS NULL)) AS "variantCount",
        FALSE AS restricted, q."archivedAt" IS NOT NULL AS archived,
        CASE WHEN q.status = 'DRAFT' AND r.status = 'MISSING_INFO' THEN 'Falta informação' WHEN q.status = 'DRAFT' AND r.status = 'READY' THEN 'Pronto para enviar' END AS flag,
        CONCAT_WS(' ',g.title,c.name,(SELECT string_agg(CONCAT_WS(' ', v.number::text,v."variationName"),' ') FROM "Quote" v WHERE v."groupId" = g.id)) AS "searchText"
      FROM "QuoteGroup" g JOIN "Client" c ON c.id = g."clientId"
      LEFT JOIN "User" u ON u.id = g."createdById"
      LEFT JOIN "QuoteRequest" r ON r.id = g."requestId" AND ${requestAccess}
      LEFT JOIN "User" ru ON ru.id = r."assignedToId"
      JOIN LATERAL (
        SELECT * FROM "Quote" v WHERE v."groupId" = g.id
        ORDER BY (v."archivedAt" IS NOT NULL), CASE v.status WHEN 'SOLD' THEN 1 WHEN 'APPROVED' THEN 2 WHEN 'WAITING_APPROVAL' THEN 3 WHEN 'SENT' THEN 4 WHEN 'DRAFT' THEN 5 ELSE 6 END, v."variationOrder", v.id LIMIT 1
      ) q ON TRUE
      LEFT JOIN "Project" p ON p.id = q."convertedProjectId" AND p."archivedAt" IS NULL
      WHERE ${groupAccess}
      UNION ALL
      SELECT 'request:' || r.id, r.title, r."clientId", c.name, r."assignedToId", u.name,
        r.id, NULL::text, NULL::text, r.status, r."dueDate", 'Retorno', r."updatedAt", NULL::float8, 0,
        EXISTS(SELECT 1 FROM "QuoteGroup" linked WHERE linked."requestId" = r.id), FALSE,
        CASE WHEN r.status = 'MISSING_INFO' THEN 'Falta informação' END,
        CONCAT_WS(' ',r.title,c.name,r.environments)
      FROM "QuoteRequest" r JOIN "Client" c ON c.id = r."clientId" JOIN "User" u ON u.id = r."assignedToId"
      WHERE ${requestAccess} AND NOT EXISTS(SELECT 1 FROM "QuoteGroup" g WHERE g."requestId" = r.id AND ${groupAccess})
    ), filtered AS (SELECT * FROM orders WHERE TRUE ${filters}),
    visible AS (SELECT * FROM filtered WHERE ${input.view || 'active'} = 'all'
      OR (${input.view || 'active'} = 'active' AND status NOT IN ('SOLD','LOST','CANCELLED'))
      OR (${input.view || 'active'} = 'closed' AND status = 'CANCELLED')
      OR (${input.view || 'active'} = 'lost' AND status = 'LOST')
      OR (${input.view || 'active'} = 'sold' AND status = 'SOLD')),
    paged AS (SELECT * FROM visible ORDER BY "updatedAt" DESC, id LIMIT ${input.pageSize} OFFSET ${(input.page - 1) * input.pageSize})
    SELECT json_build_object(
      'items', COALESCE((SELECT json_agg(row_to_json(paged)::jsonb - 'searchText') FROM paged),'[]'::json),
      'total',(SELECT COUNT(*)::int FROM visible),
      'owners', COALESCE((SELECT json_agg(x) FROM (SELECT DISTINCT "ownerId" AS id, "ownerName" AS name FROM orders WHERE "ownerId" IS NOT NULL ORDER BY name) x),'[]'::json),
      'counts',json_build_object('all',(SELECT COUNT(*)::int FROM filtered),
        'active',(SELECT COUNT(*)::int FROM filtered WHERE status NOT IN ('SOLD','LOST','CANCELLED')),
        'closed',(SELECT COUNT(*)::int FROM filtered WHERE status = 'CANCELLED'),
        'lost',(SELECT COUNT(*)::int FROM filtered WHERE status = 'LOST'),
        'sold',(SELECT COUNT(*)::int FROM filtered WHERE status = 'SOLD'))
    ) AS result
  `
}
