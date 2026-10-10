import { signedNet } from './gameMath';

export default function ResultSummary({ payout, bet }: { payout: number; bet: number }) {
  const net = payout - bet;
  return (
    <div className={net > 0 ? 'text-success' : net < 0 ? 'text-error' : 'text-gray-300'} role="status">
      <p>Retour brut : {payout.toLocaleString('fr-FR')} GC</p>
      <p className="font-semibold">Resultat net : {signedNet(payout, bet)} GC</p>
    </div>
  );
}
