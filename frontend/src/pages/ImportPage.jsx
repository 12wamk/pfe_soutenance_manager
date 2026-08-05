import React, { useState, useRef } from 'react';
import Layout from '../components/layout/Layout';
import { Button } from '../components/ui';
import { adminApi } from '../services/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Upload, FileText, CheckCircle, AlertCircle, Download, Users } from 'lucide-react';

const CSV_EXAMPLE = `code_etudiant,nom,prenom,niveau,encadrant_nom,encadrant_prenom,titre_sujet,date_debut,date_fin
SII-01,Rifi,Bilel,3 GII-SII,Chokri,Abdelmoula,Mise en place d'une plateforme DevOps,02/02/2026,31/07/2026
ET2024011,Masmoudi,Rami,Licence TIC,Trabelsi,Sonia,Analyse de vulnérabilités réseau avec Python,2024-02-01,2024-07-15`;

const CSV_EXAMPLE_BINOME = `ETU2026020,Ben Amor,Mohamed Amine,2 EEA-II,Khalfallah,Ali,automatiser le processus KYC,09/02/2026,19/06/2026
ETU2026021,Limam,Ala Eddine,2 EEA-II,Khalfallah,Ali,automatiser le processus KYC,09/02/2026,19/06/2026`;

export default function ImportPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;

    const nomLower = f.name.toLowerCase();

    if (nomLower.endsWith('.csv') || nomLower.endsWith('.txt')) {
      setFile(f); setResult(null);
      return;
    }

    if (nomLower.endsWith('.xlsx') || nomLower.endsWith('.xls')) {
      // Convertit le fichier Excel en CSV directement dans le navigateur,
      // avant envoi au backend (qui continue de ne recevoir que du CSV).
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'array' });
          const premiereFeuille = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[premiereFeuille];
          const csvString = XLSX.utils.sheet_to_csv(worksheet);

          const csvBlob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
          const nomCsv = f.name.replace(/\.(xlsx|xls)$/i, '.csv');
          const fichierConverti = new File([csvBlob], nomCsv, { type: 'text/csv' });

          setFile(fichierConverti);
          setResult(null);
          toast.success('Fichier Excel converti en CSV automatiquement');
        } catch (err) {
          toast.error("Impossible de lire ce fichier Excel");
        }
      };
      reader.readAsArrayBuffer(f);
      return;
    }

    toast.error('Format CSV ou Excel requis (.csv, .txt, .xlsx, .xls)');
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await adminApi.import(fd);
      setResult(r.data);
      toast.success(r.data.message);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Erreur lors de l\'import');
    } finally { setLoading(false); }
  };

  const downloadExample = () => {
    const blob = new Blob([CSV_EXAMPLE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'exemple_import.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout title="Import CSV" requiredRoles={['admin', 'chef_dept']}>
      <div className="flex justify-center">
        <div className="w-full max-w-3xl space-y-6 py-4">

          {/* En-tête de page centré */}
          <div className="text-center mb-2">
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Import des Étudiants & Sujets de PFE
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Importez en masse les étudiants, leurs encadrants et leurs sujets de soutenance
            </p>
          </div>

          {/* Format info */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">Format du fichier CSV</h3>
              <Button variant="outline" size="sm" icon={Download} onClick={downloadExample}>
                Télécharger exemple
              </Button>
            </div>
            <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-4 overflow-x-auto">
              <code className="text-xs text-green-400 font-mono whitespace-pre">{CSV_EXAMPLE}</code>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2"><CheckCircle size={15} className="text-green-500 flex-shrink-0" /> 9 colonnes séparées par des virgules</div>
              <div className="flex items-center gap-2"><CheckCircle size={15} className="text-green-500 flex-shrink-0" /> Encodage UTF-8</div>
              <div className="flex items-center gap-2"><CheckCircle size={15} className="text-green-500 flex-shrink-0" /> Dates au format YYYY-MM-DD</div>
              <div className="flex items-center gap-2"><CheckCircle size={15} className="text-green-500 flex-shrink-0" /> 1ère ligne = en-tête (ignorée)</div>
              <div className="flex items-center gap-2 sm:col-span-2"><CheckCircle size={15} className="text-green-500 flex-shrink-0" /> Fichiers .xlsx / .xls également acceptés (convertis automatiquement)</div>
            </div>
          </div>

          {/* Binômes : détection automatique, sans colonne dédiée */}
          <div className="bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-200 dark:border-purple-900/40 p-6 shadow-sm">
            <h3 className="font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2 mb-2">
              <Users size={16} /> Soutenances en binôme
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Pas de colonne particulière à ajouter : si <strong>2 lignes</strong> partagent exactement le
              même <strong>niveau</strong>, <strong>titre du sujet</strong>, <strong>dates</strong> et
              <strong> encadrant</strong>, elles sont automatiquement regroupées en une seule soutenance
              à 2 étudiants. Si 3 lignes ou plus se retrouvent identiques, aucune fusion n'est faite
              automatiquement (cas ambigu) — un message d'erreur le signale pour vérification manuelle.
            </p>
            <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-4 overflow-x-auto">
              <code className="text-xs text-purple-300 font-mono whitespace-pre">{CSV_EXAMPLE_BINOME}</code>
            </div>
          </div>

          {/* Upload zone */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' :
                file ? 'border-green-400 bg-green-50 dark:bg-green-900/20' :
                'border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <input ref={inputRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={e => handleFile(e.target.files[0])} />
              {file ? (
                <>
                  <FileText size={40} className="text-green-500" />
                  <div className="text-center">
                    <p className="font-semibold text-green-700 dark:text-green-400">{file.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB – Cliquez pour changer</p>
                  </div>
                </>
              ) : (
                <>
                  <Upload size={40} className="text-slate-400" />
                  <div className="text-center">
                    <p className="font-medium text-slate-600 dark:text-slate-300">Glissez votre fichier CSV ou Excel ici</p>
                    <p className="text-sm text-slate-400 mt-1">ou cliquez pour sélectionner</p>
                  </div>
                </>
              )}
            </div>

            {file && (
              <Button variant="primary" icon={Upload} onClick={handleImport} loading={loading}
                className="w-full justify-center py-3 mt-5 !bg-blue-600 hover:!bg-blue-700">
                Importer le fichier
              </Button>
            )}
          </div>

          {/* Results */}
          {result && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">Résultats de l'import</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-green-700 dark:text-green-400">{result.data?.success || 0}</p>
                  <p className="text-xs text-green-600 dark:text-green-500 font-medium mt-1">Créés</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-blue-700 dark:text-blue-400">{result.data?.skipped || 0}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-500 font-medium mt-1">Mis à jour</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-purple-700 dark:text-purple-400 flex items-center justify-center gap-1">
                    <Users size={16} />{result.data?.nb_binomes || 0}
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-500 font-medium mt-1">Binômes détectés</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-red-700 dark:text-red-400">{result.data?.errors?.length || 0}</p>
                  <p className="text-xs text-red-600 dark:text-red-500 font-medium mt-1">Erreurs</p>
                </div>
              </div>

              {result.data?.errors?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                    <AlertCircle size={14} /> Erreurs détectées
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {result.data.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-700 dark:text-red-400">
                        <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.data?.success > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-green-700 dark:text-green-400">
                  <CheckCircle size={15} />
                  Import terminé avec succès !
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}