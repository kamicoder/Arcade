// Annuler et Rétablir : deux piles de souvenirs du niveau.
// Avant chaque geste, on RETIENT une copie (pile « avant »). Annuler la reprend, et range le niveau
// qu'on quitte sur la pile « après », que Rétablir reprend à son tour. Une copie, c'est le niveau
// écrit en texte (JSON) : un souvenir qui ne bougera plus, même si on change le niveau ensuite.

export class Historique<Etat> {
  private avant: string[] = [];
  private apres: string[] = [];

  constructor(private limite = 100) {}

  retenir(etat: Etat) {
    this.avant.push(JSON.stringify(etat));
    if (this.avant.length > this.limite) {
      this.avant.shift();                  // au-delà de la limite, on oublie le plus vieux
    }
    this.apres = [];                       // un nouveau geste : ce qu'on avait annulé ne revient plus
  }

  // L'état d'avant, ou null s'il n'y a rien à annuler
  annuler(actuel: Etat): Etat | null {
    const souvenir = this.avant.pop();
    if (souvenir === undefined) {
      return null;
    }
    this.apres.push(JSON.stringify(actuel));
    return JSON.parse(souvenir) as Etat;
  }

  retablir(actuel: Etat): Etat | null {
    const souvenir = this.apres.pop();
    if (souvenir === undefined) {
      return null;
    }
    this.avant.push(JSON.stringify(actuel));
    return JSON.parse(souvenir) as Etat;
  }

  vider() {
    this.avant = [];
    this.apres = [];
  }

  get peutAnnuler(): boolean {
    return this.avant.length > 0;
  }

  get peutRetablir(): boolean {
    return this.apres.length > 0;
  }
}
