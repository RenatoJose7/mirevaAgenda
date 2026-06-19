export function translateAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha invalidos.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }

  if (normalized.includes("user already registered")) {
    return "Este e-mail ja esta cadastrado. Tente entrar.";
  }

  if (normalized.includes("token") || normalized.includes("otp")) {
    return "Codigo invalido ou expirado. Confira o e-mail ou solicite um novo codigo.";
  }

  if (normalized.includes("password")) {
    return "A senha informada nao atende aos requisitos.";
  }

  return "Nao foi possivel concluir a acao. Verifique os dados e tente novamente.";
}
