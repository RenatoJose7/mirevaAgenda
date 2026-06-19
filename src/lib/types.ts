export type AppointmentStatus =
  | "aguardando_confirmacao"
  | "confirmado"
  | "cancelado"
  | "cliente_nao_apareceu";

export type Business = {
  name: string;
  segment: string;
  whatsapp: string;
  address: string;
  slug: string;
  theme: string;
  confirmationMode: "automatico" | "manual";
};

export type Professional = {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  status: "ativo" | "inativo";
  serviceIds: string[];
};

export type Service = {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  baseDuration: number;
  status: "ativo" | "inativo";
};

export type ProfessionalService = {
  serviceId: string;
  professionalId: string;
  price: number;
  duration: number;
};

export type Appointment = {
  id: string;
  clientName: string;
  clientWhatsapp: string;
  serviceId: string;
  professionalId: string;
  date: string;
  time: string;
  status: AppointmentStatus;
};

export type Notification = {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "nova_reserva" | "cancelamento" | "pendente" | "sistema";
  read: boolean;
};

export type ThemeOption = {
  id: string;
  name: string;
  description: string;
  colors: string[];
};
