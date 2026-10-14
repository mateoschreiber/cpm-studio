import { useEffect, useRef, useState } from "react";
import { Copy, FolderOpen, Trash2, X } from "lucide-react";
import type { ProjectSummary } from "../services/projectLibrary";
import { CommitInput } from "./Fields";
import "./library.css";

interface Props {
  projects: ProjectSummary[];
  onOpen: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onDuplicate: (id: string) => void | Promise<void>;
  onRename: (id: string, name: string) => void | Promise<void>;
  onClose: () => void;
}

export function LibraryDialog({ projects, onOpen, onDelete, onDuplicate, onRename, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  async function act(operation: () => void | Promise<void>) {
    setBusy(true);
    try { await operation(); } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="library-dialog" aria-labelledby="library-title" onCancel={onClose}>
    <header className="library-heading">
      <div><h2 id="library-title">Tus proyectos</h2><p>Guardados en este navegador, disponibles sin conexión.</p></div>
      <button type="button" className="icon-button" aria-label="Cerrar biblioteca" onClick={onClose}><X size={18} /></button>
    </header>
    <div className="library-list" aria-busy={busy}>
      {!projects.length && <p>No hay proyectos guardados todavía.</p>}
      {projects.map(project => <article className="library-project" key={project.id}>
        <div className="library-name">
          <CommitInput value={project.name} label={`Nombre de ${project.name}`} disabled={busy} onCommit={name => { void act(() => onRename(project.id, name)); }} />
          <small>Actualizado {new Date(project.updatedAt).toLocaleString("es-PY")}</small>
        </div>
        {deleting === project.id ? <div className="library-delete-confirm">
          <span>¿Eliminar este proyecto? Descarga su JSON si quieres conservarlo.</span>
          <button type="button" disabled={busy} onClick={() => { void act(async () => { await onDelete(project.id); setDeleting(null); }); }}>Sí, eliminar</button>
          <button type="button" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button>
        </div> : <div className="library-actions">
          <button type="button" disabled={busy} onClick={() => { void act(async () => { await onOpen(project.id); onClose(); }); }}><FolderOpen size={16} />Abrir</button>
          <button type="button" disabled={busy} aria-label={`Duplicar ${project.name}`} onClick={() => { void act(() => onDuplicate(project.id)); }}><Copy size={16} /></button>
          <button type="button" disabled={busy} aria-label={`Eliminar ${project.name}`} onClick={() => setDeleting(project.id)}><Trash2 size={16} /></button>
        </div>}
      </article>)}
    </div>
    <footer className="library-footer">Los proyectos pertenecen a este sitio y dispositivo. Usa JSON para trasladarlos a otro navegador o dominio.</footer>
  </dialog>;
}
