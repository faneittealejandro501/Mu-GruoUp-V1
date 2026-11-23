import React, { useEffect, useState } from 'react';
import { FolderCog, RotateCcw, Save, X } from 'lucide-react';
import {
  getAdminConfigSync,
  loadAdminConfig,
  resetAdminSection,
  saveAdminSection,
  type AdminSectionKey,
} from '../services/adminConfigService';

interface AdminConfigModalProps {
  open: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

const TABS: Array<{ key: AdminSectionKey; label: string; hint: string }> = [
  { key: 'world-rules', label: 'Reglas Mundo', hint: 'Radio ciudad 500m, streaming 100m, velocidad alas 1.0x' },
  { key: 'monsters', label: 'Monstruos', hint: '40+ especies, aggro, respawn, modelos GLB y SFX' },
  { key: 'items', label: 'Ítems & Alas', hint: 'Sets M/F, armas, escudos, precios y alas animadas' },
  { key: 'item-options', label: 'Opciones & Brillos', hint: 'Niveles +0..+15, luces en alas y opciones Excelentes' },
  { key: 'npcs', label: 'NPCs', hint: 'Coordenadas, roles y modelos en capitales' },
  { key: 'classes-skills', label: 'Clases & Poderes', hint: 'Poderes exclusivos por clase M/F' },
];

export const AdminConfigModal: React.FC<AdminConfigModalProps> = ({ open, onClose, onApplied }) => {
  const [activeTab, setActiveTab] = useState<AdminSectionKey>('world-rules');
  const [jsonText, setJsonText] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    loadAdminConfig().then((bundle) => {
      if (!alive) return;
      setJsonText(JSON.stringify(bundle[activeTab], null, 2));
      setErrorMsg(null);
      setStatusMsg(null);
    });
    return () => {
      alive = false;
    };
  }, [open, activeTab]);

  if (!open) return null;

  const handleSave = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(jsonText) as Record<string, any>;
    } catch (err) {
      setErrorMsg(err instanceof Error ? `JSON inválido: ${err.message}` : 'JSON inválido');
      return;
    }

    setSaving(true);
    try {
      const result = await saveAdminSection(activeTab, parsed);
      setStatusMsg(
        result.savedToServer
          ? `Guardado en ADMIN/${activeTab}.json y aplicado en vivo.`
          : `Guardado offline en IndexedDB (ADMIN/${activeTab}) y aplicado en vivo.`,
      );
      onApplied?.();
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const fresh = await resetAdminSection(activeTab);
      setJsonText(JSON.stringify(fresh[activeTab], null, 2));
      setStatusMsg(`Restaurado ADMIN/${activeTab}.json original.`);
      setErrorMsg(null);
      onApplied?.();
    } finally {
      setSaving(false);
    }
  };

  const activeMeta = TABS.find((t) => t.key === activeTab) || TABS[0];
  const worldRules = getAdminConfigSync()['world-rules'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-xl bg-[#0d1320] border-2 border-amber-600/70 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#141c2e]">
          <div className="flex items-center gap-2">
            <FolderCog className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-display text-base font-bold text-amber-300">
                Carpeta ADMIN — Editor de Datos en Vivo
              </h2>
              <p className="text-[11px] text-slate-400">
                Ciudad Segura: {worldRules.cityRadiusMeters}m · Streaming Detalle: {worldRules.detailStreamRadiusMeters}m · Vel. Alas: {worldRules.wingRunSpeedMultiplier}x
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar editor ADMIN"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-[#1d2537] hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-800 bg-[#101726] overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-amber-600 text-slate-950 font-bold'
                  : 'bg-[#1a2235] text-slate-300 hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col p-3 sm:p-4 gap-2.5 overflow-hidden">
          <div className="text-xs text-slate-300 flex items-center justify-between gap-2 flex-wrap">
            <span>
              Archivo: <code className="text-amber-300 font-mono">ADMIN/{activeTab}.json</code> — {activeMeta.hint}
            </span>
          </div>

          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
            className="flex-1 min-h-[260px] w-full rounded-lg bg-[#080c14] border border-slate-700 focus:border-amber-500 outline-none p-3 font-mono text-xs text-emerald-200 resize-none mu-scroll"
          />

          {errorMsg && (
            <div className="px-3 py-2 rounded-lg bg-rose-950/80 border border-rose-500/70 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}
          {statusMsg && (
            <div className="px-3 py-2 rounded-lg bg-emerald-950/80 border border-emerald-500/70 text-xs text-emerald-200">
              {statusMsg}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              onClick={handleReset}
              disabled={saving}
              className="min-h-[42px] px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Restaurar Original
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="min-h-[42px] px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Aplicando...' : 'Guardar y Aplicar al Juego'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
