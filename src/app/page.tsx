import { redirect } from "next/navigation";

export default function RootPage() {
  // Isso vai te levar direto para o menu "login" que já está pronto
  redirect("/login");
}