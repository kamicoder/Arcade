// Les images de la catapulte, dessinées avec le canvas du navigateur. Chaque image : son nom (le fichier
// public/catapulte/<nom>.png), sa taille, et comment la dessiner. dessiner.mjs les enregistre.
// Pour retoucher une image : changer son dessin ici, puis relancer `node outils/catapulte/dessiner.mjs`.

/* global window */
(() => {
  const images = [];
  const ajouter = (nom, largeur, hauteur, dessin) => images.push({ nom, largeur, hauteur, dessin });

  // —— Des outils de dessin ——

  // Un rectangle aux coins arrondis
  function arrondi(c, x, y, l, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + l, y, x + l, y + h, r);
    c.arcTo(x + l, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + l, y, r);
    c.closePath();
  }

  // Un hasard toujours le même : les images ne changent pas d'un dessin à l'autre
  function hasard(graine) {
    let s = graine;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  }

  // Des fissures qui partent d'un point, en zigzag
  function fissures(c, l, h, couleur, graine) {
    const h_ = hasard(graine);
    c.strokeStyle = couleur;
    c.lineWidth = 1.6;
    c.lineCap = "round";
    for (let n = 0; n < 3; n++) {
      let x = l * (0.25 + h_() * 0.5);
      let y = h * (0.2 + h_() * 0.6);
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (h_() - 0.5) * Math.min(l, 40) * 0.5;
        y += (h_() - 0.5) * Math.min(h, 40) * 0.6;
        c.lineTo(Math.max(2, Math.min(l - 2, x)), Math.max(2, Math.min(h - 2, y)));
      }
      c.stroke();
    }
  }

  // —— Les matières : bois, pierre, glace, en trois formes chacune ——

  const FORMES = { carre: [40, 40], court: [80, 20], long: [160, 20] };

  function bois(c, l, h, abime) {
    const degrade = c.createLinearGradient(0, 0, 0, h);
    degrade.addColorStop(0, abime ? "#c08043" : "#dc9a52");
    degrade.addColorStop(1, abime ? "#93582a" : "#b06d33");
    arrondi(c, 1, 1, l - 2, h - 2, 3);
    c.fillStyle = degrade;
    c.fill();
    // Les veines du bois, dans la longueur
    const h_ = hasard(l * 7 + h);
    c.strokeStyle = "rgba(110, 60, 20, 0.45)";
    c.lineWidth = 1;
    const veines = Math.max(2, Math.round(Math.min(l, h) / 7));
    for (let v = 0; v < veines; v++) {
      const y0 = (h / (veines + 1)) * (v + 1);
      c.beginPath();
      c.moveTo(3, y0);
      for (let x = 3; x <= l - 3; x += 8) {
        c.lineTo(x, y0 + Math.sin(x / 9 + v) * 1.2 + (h_() - 0.5));
      }
      c.stroke();
    }
    // Un nœud dans les grandes pièces
    if (l >= 80 || h >= 40) {
      c.fillStyle = "rgba(110, 60, 20, 0.5)";
      c.beginPath();
      c.ellipse(l * 0.62, h * 0.5, Math.min(5, l / 10), Math.min(3, h / 6), 0, 0, Math.PI * 2);
      c.fill();
    }
    // Des clous aux bouts des poutres
    if (l > h) {
      c.fillStyle = "#6b6f78";
      for (const x of [7, l - 7]) {
        c.beginPath();
        c.arc(x, h / 2, 2, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (abime) {
      fissures(c, l, h, "rgba(60, 30, 10, 0.85)", l + h);
    }
    arrondi(c, 1, 1, l - 2, h - 2, 3);
    c.strokeStyle = "#6e3f18";
    c.lineWidth = 2;
    c.stroke();
  }

  function pierre(c, l, h, abime) {
    const degrade = c.createLinearGradient(0, 0, l, h);
    degrade.addColorStop(0, abime ? "#a3a8af" : "#b9bec6");
    degrade.addColorStop(1, abime ? "#6f747c" : "#80868f");
    arrondi(c, 1, 1, l - 2, h - 2, 4);
    c.fillStyle = degrade;
    c.fill();
    // Des taches plus claires et plus sombres : le grain de la pierre
    const h_ = hasard(l * 13 + h * 3);
    for (let n = 0; n < (l * h) / 120; n++) {
      c.fillStyle = h_() < 0.5 ? "rgba(255,255,255,0.18)" : "rgba(40,44,52,0.18)";
      c.beginPath();
      c.arc(4 + h_() * (l - 8), 4 + h_() * (h - 8), 1 + h_() * 2.2, 0, Math.PI * 2);
      c.fill();
    }
    // Un reflet en haut, une ombre en bas : la pierre a du relief
    c.fillStyle = "rgba(255,255,255,0.25)";
    c.fillRect(4, 3, l - 8, 2);
    c.fillStyle = "rgba(0,0,0,0.18)";
    c.fillRect(4, h - 5, l - 8, 2);
    if (abime) {
      fissures(c, l, h, "rgba(35, 38, 45, 0.9)", l * 3 + h);
    }
    arrondi(c, 1, 1, l - 2, h - 2, 4);
    c.strokeStyle = "#4f545c";
    c.lineWidth = 2;
    c.stroke();
  }

  function glace(c, l, h, abime) {
    const degrade = c.createLinearGradient(0, 0, l, h);
    degrade.addColorStop(0, "rgba(220, 245, 255, 0.95)");
    degrade.addColorStop(1, "rgba(140, 205, 240, 0.9)");
    arrondi(c, 1, 1, l - 2, h - 2, 3);
    c.fillStyle = degrade;
    c.fill();
    // Des reflets en biais
    c.strokeStyle = "rgba(255, 255, 255, 0.8)";
    c.lineWidth = 2;
    for (let x = -h; x < l; x += 26) {
      c.beginPath();
      c.moveTo(Math.max(4, x + 6), Math.min(h - 4, Math.max(4, 4 + (Math.max(4, x + 6) - x - 6))));
      c.lineTo(Math.min(l - 4, x + 6 + h * 0.5), Math.max(4, 4 + h * 0.5 - Math.max(0, x + 6 + h * 0.5 - (l - 4))));
      c.stroke();
    }
    if (abime) {
      fissures(c, l, h, "rgba(255, 255, 255, 0.95)", l * 5 + h);
      fissures(c, l, h, "rgba(70, 140, 190, 0.7)", l * 5 + h + 1);
    }
    arrondi(c, 1, 1, l - 2, h - 2, 3);
    c.strokeStyle = "#5aa6d6";
    c.lineWidth = 2;
    c.stroke();
  }

  for (const [matiere, dessin] of [["bois", bois], ["pierre", pierre], ["glace", glace]]) {
    for (const [forme, [l, h]] of Object.entries(FORMES)) {
      ajouter(`${matiere}-${forme}`, l, h, (c) => dessin(c, l, h, false));
      ajouter(`${matiere}-${forme}-abime`, l, h, (c) => dessin(c, l, h, true));
    }
  }

  // —— Les slimes ——

  // Un slime : une goutte de gelée verte, avec des yeux. « humeur » : content, aie
  function slime(c, l, h, humeur, couleurs) {
    const [clair, fonce, contour] = couleurs;
    const degrade = c.createRadialGradient(l * 0.4, h * 0.35, 2, l * 0.5, h * 0.6, l * 0.7);
    degrade.addColorStop(0, clair);
    degrade.addColorStop(1, fonce);
    c.beginPath();
    c.moveTo(3, h - 3);
    c.bezierCurveTo(1, h * 0.35, l * 0.25, 2, l * 0.5, 2);
    c.bezierCurveTo(l * 0.75, 2, l - 1, h * 0.35, l - 3, h - 3);
    c.quadraticCurveTo(l * 0.5, h + 1, 3, h - 3);
    c.closePath();
    c.fillStyle = degrade;
    c.fill();
    c.strokeStyle = contour;
    c.lineWidth = 2;
    c.stroke();
    // Le reflet de la gelée
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.beginPath();
    c.ellipse(l * 0.3, h * 0.3, l * 0.08, h * 0.12, -0.5, 0, Math.PI * 2);
    c.fill();
    // Les yeux
    const yeux = [l * 0.36, l * 0.64];
    const yY = h * 0.5;
    const r = Math.max(4, l * 0.1);
    for (const x of yeux) {
      if (humeur === "aie") {
        // Des yeux plissés en croix
        c.strokeStyle = "#1c1a25";
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(x - r * 0.7, yY - r * 0.7);
        c.lineTo(x + r * 0.7, yY + r * 0.7);
        c.moveTo(x + r * 0.7, yY - r * 0.7);
        c.lineTo(x - r * 0.7, yY + r * 0.7);
        c.stroke();
      } else {
        c.fillStyle = "#ffffff";
        c.beginPath();
        c.arc(x, yY, r, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#1c1a25";
        c.beginPath();
        c.arc(x - r * 0.25, yY + r * 0.15, r * 0.5, 0, Math.PI * 2);
        c.fill();
      }
    }
    // La bouche : un sourire narquois, ou un « o » de surprise
    c.strokeStyle = "#1c1a25";
    c.lineWidth = 2;
    c.beginPath();
    if (humeur === "aie") {
      c.arc(l * 0.5, h * 0.76, Math.max(2.5, l * 0.06), 0, Math.PI * 2);
    } else {
      c.arc(l * 0.5, h * 0.66, l * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
    }
    c.stroke();
  }

  const VERT = ["#9cf08a", "#3d9e31", "#25661c"];
  const VIOLET = ["#d9a6ff", "#8a3fd1", "#4f1f80"];
  ajouter("slime", 44, 40, (c) => slime(c, 44, 40, "content", VERT));
  ajouter("slime-aie", 44, 40, (c) => slime(c, 44, 40, "aie", VERT));
  // Le chef : plus gros, violet, avec une couronne (dessinée au-dessus du corps)
  const chef = (humeur) => (c) => {
    c.save();
    c.translate(0, 14);
    slime(c, 64, 56, humeur, VIOLET);
    c.restore();
    c.fillStyle = "#ffd23f";
    c.strokeStyle = "#a8781a";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(20, 20);
    c.lineTo(22, 4);
    c.lineTo(28, 12);
    c.lineTo(32, 1);
    c.lineTo(36, 12);
    c.lineTo(42, 4);
    c.lineTo(44, 20);
    c.closePath();
    c.fill();
    c.stroke();
  };
  ajouter("chef", 64, 70, chef("content"));
  ajouter("chef-aie", 64, 70, chef("aie"));

  // —— Les boulets ——

  function boule(c, d, centre, bord, contour) {
    const degrade = c.createRadialGradient(d * 0.35, d * 0.35, 1, d * 0.5, d * 0.5, d * 0.5);
    degrade.addColorStop(0, centre);
    degrade.addColorStop(1, bord);
    c.beginPath();
    c.arc(d / 2, d / 2, d / 2 - 1.5, 0, Math.PI * 2);
    c.fillStyle = degrade;
    c.fill();
    c.strokeStyle = contour;
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.beginPath();
    c.arc(d * 0.34, d * 0.32, d * 0.1, 0, Math.PI * 2);
    c.fill();
  }
  ajouter("boulet", 26, 26, (c) => boule(c, 26, "#c9ccd2", "#6e737c", "#454a52"));
  ajouter("boulet-lourd", 32, 32, (c) => {
    boule(c, 32, "#5c6577", "#1f242e", "#0f1218");
    // Des rivets : c'est du fer
    c.fillStyle = "#9aa3b5";
    for (const [x, y] of [[16, 6], [26, 16], [16, 26], [6, 16]]) {
      c.beginPath();
      c.arc(x, y, 1.6, 0, Math.PI * 2);
      c.fill();
    }
  });
  ajouter("boulet-triple", 26, 26, (c) => {
    boule(c, 26, "#ffb3e0", "#c2368a", "#7a1d55");
    c.fillStyle = "#ffffff";
    for (const [x, y] of [[13, 8], [8, 16], [18, 16]]) {
      c.beginPath();
      c.arc(x, y, 2.2, 0, Math.PI * 2);
      c.fill();
    }
  });
  ajouter("boulet-petit", 20, 20, (c) => boule(c, 20, "#ffb3e0", "#c2368a", "#7a1d55"));

  // —— La fronde : un Y en bois sur un socle de pierre ——

  ajouter("fronde", 60, 130, (c) => {
    const brancheBois = (x1, y1, x2, y2, epaisseur) => {
      c.strokeStyle = "#6e3f18";
      c.lineWidth = epaisseur + 4;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
      c.strokeStyle = "#c27f3e";
      c.lineWidth = epaisseur;
      c.stroke();
    };
    brancheBois(30, 110, 30, 62, 12);
    brancheBois(30, 66, 10, 12, 9);
    brancheBois(30, 66, 50, 12, 9);
    // Le socle
    arrondi(c, 8, 104, 44, 24, 5);
    c.fillStyle = "#8a9099";
    c.fill();
    c.strokeStyle = "#4f545c";
    c.lineWidth = 2;
    c.stroke();
  });

  // —— Le décor ——

  ajouter("ciel", 960, 540, (c) => {
    const degrade = c.createLinearGradient(0, 0, 0, 540);
    degrade.addColorStop(0, "#5aa9e6");
    degrade.addColorStop(0.7, "#a9dcf5");
    degrade.addColorStop(1, "#e4f6ff");
    c.fillStyle = degrade;
    c.fillRect(0, 0, 960, 540);
    // Le soleil
    const soleil = c.createRadialGradient(780, 110, 10, 780, 110, 90);
    soleil.addColorStop(0, "rgba(255, 250, 210, 1)");
    soleil.addColorStop(0.35, "rgba(255, 236, 150, 0.9)");
    soleil.addColorStop(1, "rgba(255, 236, 150, 0)");
    c.fillStyle = soleil;
    c.fillRect(660, 0, 260, 230);
  });

  // Un nuage, tout en ronds
  ajouter("nuage", 180, 80, (c) => {
    c.fillStyle = "rgba(255,255,255,0.95)";
    for (const [x, y, r] of [[45, 52, 26], [80, 38, 34], [120, 46, 28], [148, 56, 20], [90, 58, 24]]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });

  // Des collines au loin, qui se raccordent d'un bord à l'autre (une TileSprite les répète). Une marge
  // transparente en haut : une tuile répétée « bave » sinon d'un bord sur l'autre.
  ajouter("collines", 960, 220, (c) => {
    for (const [couleur, hauteur, bosses, phase] of [["#8fc77a", 120, 2, 0.4], ["#6fae5c", 80, 3, 1.3]]) {
      c.fillStyle = couleur;
      c.beginPath();
      c.moveTo(0, 220);
      for (let x = 0; x <= 960; x += 8) {
        const a = (x / 960) * Math.PI * 2;
        c.lineTo(x, 220 - hauteur + Math.sin(a * bosses + phase) * 26 + Math.sin(a * (bosses + 2)) * 10);
      }
      c.lineTo(960, 220);
      c.closePath();
      c.fill();
    }
  });

  // Le sol : de l'herbe sur de la terre, une tuile qui se répète
  ajouter("sol", 128, 80, (c) => {
    c.fillStyle = "#8a5a33";
    c.fillRect(0, 0, 128, 80);
    const h_ = hasard(31);
    for (let n = 0; n < 40; n++) {
      c.fillStyle = h_() < 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.08)";
      c.beginPath();
      c.arc(h_() * 128, 18 + h_() * 60, 1 + h_() * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "#5fb04a";
    c.fillRect(0, 0, 128, 14);
    c.fillStyle = "#4a9638";
    for (let x = 0; x < 128; x += 8) {
      c.beginPath();
      c.moveTo(x, 14);
      c.lineTo(x + 4, 20);
      c.lineTo(x + 8, 14);
      c.fill();
    }
    c.fillStyle = "#7fd065";
    c.fillRect(0, 0, 128, 3);
  });

  // —— Les éclats et les étoiles ——

  ajouter("eclat-bois", 12, 6, (c) => {
    c.fillStyle = "#c48543";
    c.fillRect(0, 0, 12, 6);
    c.strokeStyle = "#6e3f18";
    c.strokeRect(0.5, 0.5, 11, 5);
  });
  ajouter("eclat-pierre", 9, 9, (c) => {
    c.fillStyle = "#9da2aa";
    c.beginPath();
    c.moveTo(1, 3);
    c.lineTo(5, 0);
    c.lineTo(9, 4);
    c.lineTo(6, 9);
    c.lineTo(1, 8);
    c.closePath();
    c.fill();
  });
  ajouter("eclat-glace", 10, 10, (c) => {
    c.fillStyle = "rgba(200, 238, 255, 0.95)";
    c.beginPath();
    c.moveTo(5, 0);
    c.lineTo(10, 10);
    c.lineTo(0, 9);
    c.closePath();
    c.fill();
  });
  ajouter("goutte", 10, 10, (c) => {
    c.fillStyle = "#62c94f";
    c.beginPath();
    c.arc(5, 5, 4.5, 0, Math.PI * 2);
    c.fill();
  });

  function etoile(c, d, plein) {
    c.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? d * 0.48 : d * 0.2;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      c.lineTo(d / 2 + Math.cos(a) * r, d / 2 + 2 + Math.sin(a) * r);
    }
    c.closePath();
    c.fillStyle = plein ? "#ffd23f" : "rgba(30, 30, 45, 0.55)";
    c.fill();
    c.strokeStyle = plein ? "#b07d10" : "rgba(255,255,255,0.4)";
    c.lineWidth = 2;
    c.stroke();
  }
  ajouter("etoile", 48, 48, (c) => etoile(c, 48, true));
  ajouter("etoile-vide", 48, 48, (c) => etoile(c, 48, false));

  // Ce que dessiner.mjs appelle : chaque image en PNG (data URL)
  window.dessinerTout = () => images.map(({ nom, largeur, hauteur, dessin }) => {
    const toile = document.createElement("canvas");
    toile.width = largeur;
    toile.height = hauteur;
    dessin(toile.getContext("2d"));
    return { nom, png: toile.toDataURL("image/png") };
  });
  // Une planche de toutes les images, pour les regarder d'un coup d'œil
  window.planche = () => {
    document.body.style.background = "#7a8a9a";
    for (const { nom, largeur, hauteur, dessin } of images) {
      if (largeur > 400) continue;
      const toile = document.createElement("canvas");
      toile.width = largeur;
      toile.height = hauteur;
      toile.title = nom;
      toile.style.margin = "6px";
      dessin(toile.getContext("2d"));
      document.body.appendChild(toile);
    }
  };
})();
