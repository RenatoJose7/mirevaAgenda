export function translateAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha inválidos.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }

  if (normalized.includes("user already registered")) {
    return "Este e-mail já está cadastrado. Tente entrar.";
  }

  if (normalized.includes("token") || normalized.includes("otp")) {
    return "Código inválido ou expirado. Confira o e-mail ou solicite um novo código.";
  }

  if (normalized.includes("password")) {
    return "A senha informada não atende aos requisitos.";
  }

  return "Não foi possível concluir a ação. Verifique os dados e tente novamente.";
}
