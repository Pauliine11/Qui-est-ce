import type { Metadata } from "next";
import { SoloGame } from "./solo-game";

export const metadata: Metadata = {
  title: "Solo — Qui est-ce ?",
  description: "Affronte l'IA au « Qui est-ce ? » sur le thème Académie Tenkū.",
};

export default function SoloPage() {
  return <SoloGame />;
}
