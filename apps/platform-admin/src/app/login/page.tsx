import { ActionForm } from "@/components/action-form";
import { Card, Field, Input } from "@/components/ui";
import { login } from "./actions";

export default function LoginPage() {
  return (
    <main className="bg-muted/40 flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card title="Markazai Control Plane">
          <p className="text-muted-foreground -mt-2 text-sm">Faqat platforma xodimlari uchun.</p>
          <ActionForm action={login} submit="Kirish" className="gap-4">
            <Field label="Email">
              <Input name="email" type="email" autoComplete="username" required autoFocus />
            </Field>
            <Field label="Parol">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
          </ActionForm>
        </Card>
      </div>
    </main>
  );
}
