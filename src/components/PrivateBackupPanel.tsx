import { useState } from 'react';
import { cloudSyncManager } from '../services/cloudSyncManager';

export function PrivateBackupPanel({ onRestored }: { onRestored: () => Promise<void> }) {
  const [code, setCode] = useState('');
  const [display, setDisplay] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const run = async (restore: boolean) => {
    setBusy(true);
    setMessage('');
    try {
      if (restore) {
        const characters = await cloudSyncManager.restorePrivateBackup(code);
        setCode('');
        await onRestored();
        setMessage(`Copia restaurada: ${characters} héroes. Entra con tu cuenta o restablece tu contraseña en la opción de recuperación.`);
      } else {
        setDisplay(await cloudSyncManager.createPrivateBackup());
        setMessage('Copia guardada. Conserva este código en un lugar privado para recuperar tu cuenta.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo usar el respaldo privado.');
    } finally { setBusy(false); }
  };

  return <div className="p-4 rounded-xl bg-[#141a26] border border-slate-800 space-y-2.5">
    <h3 className="text-sm font-semibold text-sky-300">3. Copia privada</h3>
    <p className="text-xs text-slate-300">
      Guarda tu cuenta, héroes y equipo cifrados en el servidor configurado. El progreso se sincroniza cuando vuelves a conectar.
    </p>
    <button disabled={busy} onClick={() => void run(false)} className="min-h-[38px] px-3 rounded-lg bg-sky-700 text-white text-xs font-semibold disabled:opacity-50">
      Crear copia o ver mi código
    </button>
    {display && <input aria-label="Tu código privado" value={display} onFocus={e => e.target.select()} readOnly className="w-full rounded-md bg-slate-950 text-slate-200 font-mono text-xs p-2" />}
    <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void run(true); }}>
      <input type="password" autoComplete="off" aria-label="Código de recuperación" placeholder="Código de recuperación" value={code} onChange={e => setCode(e.target.value)}
        className="flex-1 min-w-40 bg-slate-950 rounded-lg border border-slate-700 px-3 text-sm min-h-[38px]" />
      <button disabled={busy || !code.trim()} className="min-h-[38px] px-3 rounded-lg bg-slate-700 text-white text-xs font-semibold disabled:opacity-50">
        Restaurar
      </button>
    </form>
    {message && <p role="status" className="text-xs text-amber-200">{message}</p>}
  </div>;
}
