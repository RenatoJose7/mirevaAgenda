import type {
  Appointment,
  Business,
  Notification,
  Professional,
  ProfessionalService,
  Service,
} from "@/lib/types";
export { themes } from "@/lib/themes";

export const business: Business = {
  name: "Negocio Exemplo",
  segment: "Serviços por agendamento",
  whatsapp: "(11) 99999-0000",
  address: "Rua das Flores, 120 - Centro",
  slug: "negócio-exemplo",
  theme: "Mireva",
  confirmationMode: "automatico",
};

export const professionals: Professional[] = [
  {
    id: "camila",
    name: "Camila Souza",
    initials: "CS",
    specialty: "Atendimentos individuais",
    status: "ativo",
    serviceIds: ["consulta-inicial", "atendimento-individual"],
  },
  {
    id: "bruna",
    name: "Bruna Lima",
    initials: "BL",
    specialty: "Serviços especializados",
    status: "ativo",
    serviceIds: ["consulta-inicial", "sessao-especializada"],
  },
  {
    id: "rafael",
    name: "Rafael Mendes",
    initials: "RM",
    specialty: "Acompanhamento e retorno",
    status: "ativo",
    serviceIds: ["retorno"],
  },
];

export const services: Service[] = [
  {
    id: "consulta-inicial",
    name: "Consulta inicial",
    description: "Primeiro atendimento para entender a necessidade do cliente.",
    basePrice: 80,
    baseDuration: 60,
    status: "ativo",
  },
  {
    id: "atendimento-individual",
    name: "Atendimento individual",
    description: "Atendimento personalizado com horário marcado.",
    basePrice: 60,
    baseDuration: 45,
    status: "ativo",
  },
  {
    id: "sessao-especializada",
    name: "Sessão especializada",
    description: "Serviço de maior duração com avaliação prévia.",
    basePrice: 180,
    baseDuration: 120,
    status: "ativo",
  },
  {
    id: "retorno",
    name: "Retorno",
    description: "Acompanhamento breve para clientes já atendidos.",
    basePrice: 45,
    baseDuration: 40,
    status: "ativo",
  },
];

export const professionalServices: ProfessionalService[] = [
  { serviceId: "consulta-inicial", professionalId: "camila", price: 80, duration: 60 },
  { serviceId: "consulta-inicial", professionalId: "bruna", price: 95, duration: 75 },
  { serviceId: "atendimento-individual", professionalId: "camila", price: 60, duration: 45 },
  { serviceId: "sessao-especializada", professionalId: "bruna", price: 180, duration: 120 },
  { serviceId: "retorno", professionalId: "rafael", price: 45, duration: 40 },
];

export const appointments: Appointment[] = [
  {
    id: "A-1042",
    clientName: "Cliente 01",
    clientWhatsapp: "(11) 90000-1001",
    serviceId: "consulta-inicial",
    professionalId: "camila",
    date: "Hoje",
    time: "09:30",
    status: "confirmado",
  },
  {
    id: "A-1043",
    clientName: "Cliente 02",
    clientWhatsapp: "(11) 90000-1002",
    serviceId: "sessao-especializada",
    professionalId: "bruna",
    date: "Hoje",
    time: "13:00",
    status: "aguardando_confirmacao",
  },
  {
    id: "A-1044",
    clientName: "Cliente 03",
    clientWhatsapp: "(11) 90000-1003",
    serviceId: "retorno",
    professionalId: "rafael",
    date: "Amanhã",
    time: "10:20",
    status: "cancelado",
  },
  {
    id: "A-1045",
    clientName: "Cliente 04",
    clientWhatsapp: "(11) 90000-1004",
    serviceId: "atendimento-individual",
    professionalId: "camila",
    date: "Sexta",
    time: "16:00",
    status: "cliente_nao_apareceu",
  },
];

export const notifications: Notification[] = [
  {
    id: "N-01",
    title: "Nova reserva recebida",
    description: "Consulta inicial com Camila Souza às 09:30.",
    time: "ha 8 min",
    type: "nova_reserva",
    read: false,
  },
  {
    id: "N-02",
    title: "Solicitação pendente",
    description: "Sessão especializada aguardando confirmação manual.",
    time: "ha 24 min",
    type: "pendente",
    read: false,
  },
  {
    id: "N-03",
    title: "Cancelamento registrado",
    description: "Cliente 03 cancelou o horário das 10:20.",
    time: "ontem",
    type: "cancelamento",
    read: true,
  },
];

export const dateOptions = ["Hoje", "Amanhã", "Sexta", "Sábado", "Segunda"];
export const timeSlots = ["09:00", "09:30", "10:20", "11:00", "13:00", "14:30", "16:00", "17:20"];

export const popularServices = [
  { name: "Consulta inicial", total: 38, percent: 82 },
  { name: "Atendimento individual", total: 24, percent: 58 },
  { name: "Sessão especializada", total: 16, percent: 44 },
];

export const busyTimes = [
  { label: "Quarta, 14h", percent: 78 },
  { label: "Sexta, 16h", percent: 64 },
  { label: "Sábado, 10h", percent: 57 },
];

export function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getService(id: string) {
  return services.find((service) => service.id === id);
}

export function getProfessional(id: string) {
  return professionals.find((professional) => professional.id === id);
}
