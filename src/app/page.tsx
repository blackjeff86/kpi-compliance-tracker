import { redirect } from "next/navigation";

export default function RootPage() {
  // Isso vai te levar direto para o menu "Dashboard" que já está pronto
  redirect("/dashboard");
}