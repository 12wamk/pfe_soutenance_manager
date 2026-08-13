import { useState } from 'react';
import { X, Plus } from 'lucide-react';

const EXPERTISE_SUGGESTIONS = [
  'mobile', 'android', 'ios', 'flutter', 'react-native',
  'web', 'react', 'angular', 'vue', 'nodejs', 'php',
  'ai', 'machine-learning', 'deep-learning', 'nlp', 'computer-vision',
  'cybersecurite', 'pentest', 'cryptographie', 'forensics',
  'cloud', 'aws', 'azure', 'gcp', 'devops', 'kubernetes',
  'iot', 'embarque', 'arduino', 'raspberry', 'vhdl',
  'data-science', 'big-data', 'spark', 'hadoop',
  'reseau', 'tcp-ip', 'sdn', '5g',
  'blockchain', 'smart-contracts', 'web3',
  'bdd', 'sql', 'nosql', 'mongodb', 'postgresql',
  'robotique', 'automatique', 'signal',
];

const ENSEIGNEMENT_SUGGESTIONS = [
  'Développement Mobile', 'Développement Web', 'Intelligence Artificielle',
  'Sécurité Réseau', 'Base de Données', 'Cloud Computing',
  'Internet des Objets', 'Systèmes Embarqués', 'Génie Logiciel',
  'Algorithmique', 'Architecture des Ordinateurs', 'Compilation',
  'Réseaux Informatiques', 'Administration Système', 'Data Science',
];

export default function ExpertiseSelector({ expertises, enseignements, onChange }) {
  const [newExpertise, setNewExpertise] = useState('');
  const [newEnseignement, setNewEnseignement] = useState('');

  const addExpertise = (value) => {
    const v = value.trim().toLowerCase();
    if (v && !expertises.includes(v)) {
      onChange({ expertises: [...expertises, v], enseignements });
    }
    setNewExpertise('');
  };

  const removeExpertise = (value) => {
    onChange({ expertises: expertises.filter(e => e !== value), enseignements });
  };

  const addEnseignement = (value) => {
    const v = value.trim();
    if (v && !enseignements.includes(v)) {
      onChange({ expertises, enseignements: [...enseignements, v] });
    }
    setNewEnseignement('');
  };

  const removeEnseignement = (value) => {
    onChange({ expertises, enseignements: enseignements.filter(e => e !== value) });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Expertises techniques
        </label>
        <p className="text-xs text-slate-500 mb-2">
          Domaines de compétence pour le matching automatique du jury (ex: mobile, IA, web)
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {expertises.map(exp => (
            <span
              key={exp}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            >
              {exp}
              <button onClick={() => removeExpertise(exp)} className="hover:text-blue-900">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newExpertise}
            onChange={(e) => setNewExpertise(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExpertise(newExpertise))}
            placeholder="Ajouter une expertise..."
            className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => addExpertise(newExpertise)}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {EXPERTISE_SUGGESTIONS.filter(s => !expertises.includes(s)).slice(0, 12).map(s => (
            <button
              key={s}
              onClick={() => addExpertise(s)}
              className="px-2 py-0.5 text-[10px] rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Enseignements
        </label>
        <p className="text-xs text-slate-500 mb-2">
          Cours dispensés à l'université
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {enseignements.map(ens => (
            <span
              key={ens}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
            >
              {ens}
              <button onClick={() => removeEnseignement(ens)} className="hover:text-green-900">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newEnseignement}
            onChange={(e) => setNewEnseignement(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEnseignement(newEnseignement))}
            placeholder="Ajouter un enseignement..."
            className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => addEnseignement(newEnseignement)}
            className="px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {ENSEIGNEMENT_SUGGESTIONS.filter(s => !enseignements.includes(s)).slice(0, 8).map(s => (
            <button
              key={s}
              onClick={() => addEnseignement(s)}
              className="px-2 py-0.5 text-[10px] rounded border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              + {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
