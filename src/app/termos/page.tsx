import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Termos e condições de uso | Mireva Agenda",
  description: "Termos e condições de uso do Mireva Agenda.",
};

const sections = [
  {
    title: "1. Aceitação dos termos",
    content:
      "Ao criar uma conta, acessar ou utilizar o Mireva Agenda, você declara que leu, entendeu e concorda com estes termos e condições de uso. Se não concordar com alguma condição, não utilize o sistema.",
  },
  {
    title: "2. Sobre o Mireva Agenda",
    content:
      "O Mireva Agenda é um SaaS de organização de agendamentos para estabelecimentos, profissionais autônomos e equipes. O sistema permite configurar serviços, profissionais, disponibilidade, agenda pública, remarcações, cancelamentos e preferências do estabelecimento.",
  },
  {
    title: "3. Cadastro e responsabilidade da conta",
    content:
      "O usuário responsável deve fornecer informações corretas no cadastro e manter seus dados atualizados. A guarda da senha, o controle de acesso à conta e o uso das funcionalidades pelo estabelecimento são responsabilidade do titular da conta.",
  },
  {
    title: "4. Planos, limites e cobrança",
    content:
      "O Mireva Agenda pode oferecer planos com limites diferentes de profissionais, serviços e funcionalidades. Ao selecionar um plano, o usuário concorda com os valores, limites e condições apresentados na tela de contratação. Alterações de plano podem liberar ou restringir funcionalidades conforme as regras vigentes.",
  },
  {
    title: "5. Período grátis e cancelamento",
    content:
      "Quando houver período grátis, ele será informado antes da contratação. Após esse período, a cobrança seguirá o plano escolhido, salvo cancelamento ou alteração pelo usuário. O cancelamento impede novas cobranças futuras, mas não apaga automaticamente dados já cadastrados.",
  },
  {
    title: "6. Dados e privacidade",
    content:
      "Tratamos dados necessários para funcionamento do sistema, como nome, e-mail, telefone, dados do estabelecimento, serviços, profissionais e agendamentos. Esses dados são usados para autenticação, operação da agenda, suporte, segurança e cumprimento de obrigações legais.",
  },
  {
    title: "7. LGPD",
    content:
      "O usuário pode solicitar acesso, correção ou exclusão de dados pessoais, respeitados os limites técnicos, contratuais e legais. O estabelecimento é responsável pelos dados de clientes que inserir ou coletar pela agenda pública, devendo usá-los de forma adequada e compatível com a legislação aplicável.",
  },
  {
    title: "8. Uso adequado",
    content:
      "É proibido usar o Mireva Agenda para atividades ilegais, envio abusivo de mensagens, tentativa de invasão, cópia não autorizada, engenharia reversa, fraude, coleta indevida de dados ou qualquer prática que prejudique o sistema, outros usuários ou terceiros.",
  },
  {
    title: "9. Disponibilidade e mudanças no serviço",
    content:
      "Trabalhamos para manter o sistema disponível e seguro, mas podem ocorrer interrupções por manutenção, instabilidade de terceiros, falhas técnicas ou motivos externos. Funcionalidades, planos e condições podem ser atualizados para melhorar o produto ou atender exigências operacionais.",
  },
  {
    title: "10. Suporte e contato",
    content:
      "Dúvidas sobre conta, cobrança, dados ou uso do sistema devem ser encaminhadas pelos canais oficiais da Mireva. Responderemos dentro de um prazo razoável, conforme a complexidade da solicitação.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandMark />
          <Button variant="outline" asChild>
            <Link href="/cadastro">Voltar ao cadastro</Link>
          </Button>
        </div>

        <Card className="shadow-xl shadow-primary/10">
          <CardHeader className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Mireva Agenda</p>
            <CardTitle className="text-3xl">Termos e condições de uso</CardTitle>
            <p className="text-sm text-muted-foreground">Última atualização: 26 de junho de 2026.</p>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-6 text-muted-foreground">
            <p>
              Estes termos regulam o uso do Mireva Agenda. Eles foram escritos para explicar de forma objetiva o que o
              sistema oferece, quais são as responsabilidades do usuário e como os dados são tratados.
            </p>

            {sections.map((section) => (
              <section key={section.title} className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
                <p>{section.content}</p>
              </section>
            ))}

            <div className="rounded-lg border bg-secondary p-4">
              <h2 className="font-semibold text-foreground">Observação importante</h2>
              <p className="mt-2">
                Esta versão dos termos pode ser atualizada conforme o produto evoluir, especialmente com novas formas de
                pagamento, integrações e recursos. A versão vigente será sempre a publicada nesta página.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
