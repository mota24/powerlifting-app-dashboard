'use client';
import { useState } from 'react';

export default function GLCalculator() {
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [bw, setBw] = useState<number | ''>('');
  const [total, setTotal] = useState<number | ''>('');

  const calculateGL = () => {
    // Si les champs sont vides ou à 0, on n'affiche rien
    if (!bw || !total || bw <= 0 || total <= 0) return '—';

    // Les constantes officielles IPF 2020 pour le Powerlifting Classique
    const constants = {
      male: { A: 1199.72839, B: 1025.18162, C: 0.00921 },
      female: { A: 610.32796, B: 1045.59282, C: 0.03048 }
    };

    const { A, B, C } = constants[gender];
    
    // Application de la formule mathématique
    const denominator = A - B * Math.exp(-C * Number(bw));
    const coefficient = 100 / denominator;
    
    // On retourne le score avec 2 décimales
    return (Number(total) * coefficient).toFixed(2);
  };

  return (
    <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl shadow-lg mt-6">
      <h2 className="text-xl font-bold text-white mb-4">Calculateur de Points IPF GL</h2>
      <p className="text-sm text-gray-400 mb-6">Évalue ta force relative par rapport à ton poids de corps selon le standard IPF.</p>
      
      <div className="space-y-5">
        {/* Choix du Sexe */}
        <div className="flex gap-4">
          <button 
            onClick={() => setGender('male')}
            className={`flex-1 py-2.5 rounded-lg font-medium transition duration-200 ${gender === 'male' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            Homme
          </button>
          <button 
            onClick={() => setGender('female')}
            className={`flex-1 py-2.5 rounded-lg font-medium transition duration-200 ${gender === 'female' ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            Femme
          </button>
        </div>

        {/* Champs de saisie */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-400 mb-1">Poids de corps (kg)</label>
            <input 
              type="number" 
              value={bw} 
              onChange={(e) => setBw(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 83"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-400 mb-1">Total soulevé (kg)</label>
            <input 
              type="number" 
              value={total} 
              onChange={(e) => setTotal(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 500"
            />
          </div>
        </div>

        {/* Affichage du Résultat */}
        <div className="mt-4 p-5 bg-gray-950 border border-gray-800 rounded-lg flex flex-col items-center justify-center">
          <span className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">Score GL</span>
          <span className="text-4xl font-black text-white">{calculateGL()}</span>
        </div>
      </div>
    </div>
  );
}