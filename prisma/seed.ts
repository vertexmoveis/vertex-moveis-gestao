import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const prisma = new PrismaClient()

function randomPassword() {
  return randomBytes(24).toString('base64url')
}

async function main() {
  console.log('Iniciando seed...')

  // Usuários
  const adminPassword = await bcrypt.hash(randomPassword(), 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@vertexmoveis.com.br' },
    update: {},
    create: {
      name: 'Admin Vertex',
      email: 'admin@vertexmoveis.com.br',
      password: adminPassword,
      role: 'ADMIN',
    },
  })

  const manager1 = await prisma.user.upsert({
    where: { email: 'carlos@vertexmoveis.com.br' },
    update: {},
    create: {
      name: 'Carlos Silva',
      email: 'carlos@vertexmoveis.com.br',
      password: await bcrypt.hash(randomPassword(), 12),
      role: 'MANAGER',
    },
  })

  const manager2 = await prisma.user.upsert({
    where: { email: 'ana@vertexmoveis.com.br' },
    update: {},
    create: {
      name: 'Ana Rodrigues',
      email: 'ana@vertexmoveis.com.br',
      password: await bcrypt.hash(randomPassword(), 12),
      role: 'MANAGER',
    },
  })

  // Clientes
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        name: 'Roberto Almeida',
        phone: '(11) 98765-4321',
        whatsapp: '(11) 98765-4321',
        email: 'roberto.almeida@email.com',
        address: 'Rua das Flores, 123 - Vila Olímpia, SP',
        notes: 'Cliente VIP, prefere contato pelo WhatsApp',
      },
    }),
    prisma.client.create({
      data: {
        name: 'Fernanda Costa',
        phone: '(11) 97654-3210',
        whatsapp: '(11) 97654-3210',
        email: 'fernanda.costa@gmail.com',
        address: 'Av. Brigadeiro Faria Lima, 1500 - Itaim, SP',
      },
    }),
    prisma.client.create({
      data: {
        name: 'Marcos Pereira',
        phone: '(11) 96543-2109',
        whatsapp: '(11) 96543-2109',
        email: 'marcos.pereira@empresa.com',
        address: 'Rua Oscar Freire, 800 - Jardins, SP',
        notes: 'Projeto comercial - escritório',
      },
    }),
    prisma.client.create({
      data: {
        name: 'Juliana Santos',
        phone: '(11) 95432-1098',
        whatsapp: '(11) 95432-1098',
        email: 'juliana.santos@email.com',
        address: 'Rua Pamplona, 200 - Bela Vista, SP',
      },
    }),
    prisma.client.create({
      data: {
        name: 'Ricardo Oliveira',
        phone: '(11) 94321-0987',
        whatsapp: '(11) 94321-0987',
        email: 'ricardo.oliveira@hotmail.com',
        address: 'Alameda Santos, 45 - Cerqueira César, SP',
        notes: 'Segunda compra, cliente fidelizado',
      },
    }),
    prisma.client.create({
      data: {
        name: 'Patrícia Lima',
        phone: '(11) 93210-9876',
        whatsapp: '(11) 93210-9876',
        email: 'patricia.lima@email.com',
        address: 'Rua Haddock Lobo, 55 - Cerqueira César, SP',
      },
    }),
    prisma.client.create({
      data: {
        name: 'Eduardo Martins',
        phone: '(11) 92109-8765',
        whatsapp: '(11) 92109-8765',
        email: 'eduardo.martins@empresa.com.br',
        address: 'Av. Paulista, 2300 - Bela Vista, SP',
        notes: 'Projeto residencial - apartamento novo',
      },
    }),
  ])

  // Projetos
  const now = new Date()
  const days = (n: number) => new Date(now.getTime() + n * 86400000)

  const projectsData = [
    {
      clientId: clients[0].id,
      managerId: manager1.id,
      name: 'Cozinha Completa',
      room: 'Cozinha',
      status: 'IN_PRODUCTION',
      stage: 'MANUFACTURING',
      startDate: days(-30),
      estimatedEndDate: days(15),
      value: 28500,
      internalNotes: 'Madeira Freijó com puxadores dourados',
    },
    {
      clientId: clients[0].id,
      managerId: manager1.id,
      name: 'Home Office',
      room: 'Escritório',
      status: 'DESIGN_ENGINEERING',
      stage: 'DESIGN',
      startDate: days(-10),
      estimatedEndDate: days(30),
      value: 12000,
    },
    {
      clientId: clients[1].id,
      managerId: manager2.id,
      name: 'Closet Master',
      room: 'Quarto Master',
      status: 'APPROVED',
      stage: 'PENDING_START',
      startDate: days(5),
      estimatedEndDate: days(45),
      value: 35000,
      internalNotes: 'Closet com ilha central, espelho full height',
    },
    {
      clientId: clients[2].id,
      managerId: manager1.id,
      name: 'Escritório Corporativo',
      room: 'Escritório',
      status: 'INSTALLATION_SCHEDULED',
      stage: 'INSTALLATION',
      startDate: days(-60),
      estimatedEndDate: days(3),
      value: 85000,
      internalNotes: 'Projeto para 15 estações de trabalho',
    },
    {
      clientId: clients[3].id,
      managerId: manager2.id,
      name: 'Sala de Estar',
      room: 'Sala',
      status: 'COMPLETED',
      stage: 'COMPLETED',
      startDate: days(-90),
      estimatedEndDate: days(-15),
      actualEndDate: days(-14),
      value: 22000,
    },
    {
      clientId: clients[4].id,
      managerId: manager1.id,
      name: 'Dormitório Casal',
      room: 'Quarto',
      status: 'DELAYED',
      stage: 'FINISHING',
      startDate: days(-45),
      estimatedEndDate: days(-5),
      value: 18500,
      internalNotes: 'Atraso por falta de material - reordenar',
    },
    {
      clientId: clients[5].id,
      managerId: manager2.id,
      name: 'Lavanderia Planejada',
      room: 'Lavanderia',
      status: 'MEASUREMENT_SCHEDULED',
      stage: 'MEASUREMENT',
      startDate: days(2),
      estimatedEndDate: days(35),
      value: 8500,
    },
    {
      clientId: clients[6].id,
      managerId: manager1.id,
      name: 'Cozinha Americana',
      room: 'Cozinha',
      status: 'IN_PRODUCTION',
      stage: 'CUTTING',
      startDate: days(-15),
      estimatedEndDate: days(20),
      value: 31000,
      internalNotes: 'Estilo contemporâneo, sem puxadores',
    },
    {
      clientId: clients[1].id,
      managerId: manager2.id,
      name: 'Banheiro Casal',
      room: 'Banheiro',
      status: 'DESIGN_ENGINEERING',
      stage: 'DESIGN',
      startDate: days(-5),
      estimatedEndDate: days(40),
      value: 9500,
    },
    {
      clientId: clients[3].id,
      managerId: manager1.id,
      name: 'Varanda Gourmet',
      room: 'Varanda',
      status: 'IN_PRODUCTION',
      stage: 'QUALITY_CONTROL',
      startDate: days(-20),
      estimatedEndDate: days(8),
      value: 16000,
    },
  ]

  const projects = await Promise.all(
    projectsData.map((p) =>
      prisma.project.create({
        data: p as Parameters<typeof prisma.project.create>[0]['data'],
      })
    )
  )

  // Timeline events para os projetos
  for (const project of projects) {
    await prisma.timelineEvent.create({
      data: {
        projectId: project.id,
        event: 'Cadastro do Cliente',
        description: 'Cliente cadastrado no sistema',
        date: new Date(project.createdAt.getTime() - 86400000 * 2),
      },
    })
    await prisma.timelineEvent.create({
      data: {
        projectId: project.id,
        event: 'Projeto Aprovado',
        description: 'Proposta aprovada pelo cliente',
        date: project.createdAt,
      },
    })
    if (project.startDate) {
      await prisma.timelineEvent.create({
        data: {
          projectId: project.id,
          event: 'Início do Projeto',
          description: 'Projeto iniciado',
          date: project.startDate,
        },
      })
    }
  }

  // Atividades recentes
  const activities = [
    { action: 'Novo cliente cadastrado', details: 'Eduardo Martins adicionado ao sistema', userId: admin.id },
    { action: 'Projeto atualizado', details: 'Cozinha Completa avançou para Fabricação', userId: manager1.id, projectId: projects[0].id },
    { action: 'Nota adicionada', details: 'Observação sobre material adicionada', userId: manager1.id, projectId: projects[5].id },
    { action: 'Status alterado', details: 'Projeto marcado como Atrasado', userId: admin.id, projectId: projects[5].id },
    { action: 'Projeto criado', details: 'Novo projeto Banheiro Casal criado', userId: manager2.id, projectId: projects[8].id },
    { action: 'Instalação agendada', details: 'Instalação do Escritório Corporativo agendada', userId: manager1.id, projectId: projects[3].id },
    { action: 'Projeto concluído', details: 'Sala de Estar finalizada com sucesso', userId: manager2.id, projectId: projects[4].id },
  ]

  for (let i = 0; i < activities.length; i++) {
    await prisma.activityLog.create({
      data: {
        ...activities[i],
        createdAt: new Date(now.getTime() - i * 3600000 * 3),
      },
    })
  }

  console.log('Seed concluído com sucesso!')
  console.log('Seed concluido. Defina senhas reais por fluxo administrativo seguro antes de usar o ambiente.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
