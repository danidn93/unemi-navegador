// src/components/ModalPortal.tsx
import React from "react";
import { createPortal } from "react-dom";

type Props = { children: React.ReactNode; targetId?: string };

/**
 * Portal que intenta montar en el elemento con id `targetId` (por defecto "modal-root").
 * Si no existe (ej. en páginas que no hayan añadido el contenedor), cae a document.body.
 *
 * Esto permite que los modales se rendericen *dentro* del contenedor de mapa (para que
 * su overlay solo cubra esa área), en lugar de siempre ocupar todo el viewport.
 */
export default function ModalPortal({ children, targetId = "modal-root" }: Props) {
  if (typeof document === "undefined") return <>{children}</>;
  const target = document.getElementById(targetId) || document.body;
  return createPortal(children, target);
}
