// Importa il nuovo contratto
const BNCalcolatoreOnChain = artifacts.require("BNCalcolatoreOnChain");

module.exports = async function (deployer, network, accounts) {
  
  // Definiamo gli attori (come nei test)
  const admin = accounts[0]; // Chi fa il deploy
  const indirizzoOracolo = accounts[0]; // Per semplicità, chi deploya è anche l'Oracolo
  const indirizzoSensore = accounts[1]; // Un account che simula tutti i sensori
  const indirizzoMittente = accounts[2];

  console.log("----------------------------------------------------");
  console.log("Deploying BNCalcolatoreOnChain...");
  console.log("----------------------------------------------------");

  // 1. DEPLOY DEL CONTRATTO
  // Il costruttore ora assegna i ruoli a 'admin' (accounts[0])
  await deployer.deploy(BNCalcolatoreOnChain, { from: admin });
  const instance = await BNCalcolatoreOnChain.deployed();
  console.log("Contratto deployato a:", instance.address);

  // Assegniamo i ruoli agli altri account per i test
  await instance.grantRole(await instance.RUOLO_SENSORE(), indirizzoSensore, { from: admin });
  await instance.grantRole(await instance.RUOLO_MITTENTE(), indirizzoMittente, { from: admin });
  console.log(`Ruolo SENSORE assegnato a: ${indirizzoSensore}`);
  console.log(`Ruolo MITTENTE assegnato a: ${indirizzoMittente}`);


  // --- 2. SETUP DELLE PROBABILITÀ (Come da PDF, pag. 17-18) ---
  
  // Useremo valori (0-100) per rappresentare le probabilità (0.0 - 1.0)
  const PRECISIONE = 100;

  console.log("Inizio setup probabilità (CPT)...");

  // 2a. Imposta probabilità a priori: P(F1=T)=90%, P(F2=T)=90%
  await instance.impostaProbabilitaAPriori(90, 90, { from: indirizzoOracolo });
  console.log("Probabilità a priori impostate (P(F1)=90, P(F2)=90)");

  // 2b. Imposta le CPT (Tabelle di Probabilità Condizionale)
  // Creiamo delle tabelle di esempio realistiche
  // { p_FF, p_FT, p_TF, p_TT }

  // E1 (Temperatura): Dipende da F1
  // Se F1=T, E1=T (sensore OK) al 98%
  // Se F1=F, E1=T (falso positivo) al 5%
  // (Ignoriamo F2, quindi p_FT = p_FF e p_TT = p_TF)
  const cpt_E1 = { p_FF: 5, p_FT: 5, p_TF: 98, p_TT: 98 };
  await instance.impostaCPT(1, cpt_E1, { from: indirizzoOracolo });

  // E2 (Sigillo): Dipende da F2
  // Se F2=T, E2=T (sigillo intatto) al 99%
  // Se F2=F, E2=T (falso positivo) al 1%
  const cpt_E2 = { p_FF: 1, p_FT: 99, p_TF: 1, p_TT: 99 };
  await instance.impostaCPT(2, cpt_E2, { from: indirizzoOracolo });

  // E3 (Shock): Dipende da F2
  // Se F2=T, E3=T (falso shock) al 10%
  // Se F2=F, E3=T (shock vero) al 70%
  const cpt_E3 = { p_FF: 70, p_FT: 10, p_TF: 70, p_TT: 10 };
  await instance.impostaCPT(3, cpt_E3, { from: indirizzoOracolo });

  // E4 (Luce): Dipende da F2
  // Se F2=T, E4=T (falso allarme luce) al 2%
  // Se F2=F, E4=T (pacco aperto) al 95%
  const cpt_E4 = { p_FF: 95, p_FT: 2, p_TF: 95, p_TT: 2 };
  await instance.impostaCPT(4, cpt_E4, { from: indirizzoOracolo });

  // E5 (Scan): Dipende da F1 e F2 (ipotizziamo)
  // (Logica inventata: se tutto OK (TT) 99%, se tutto KO (FF) 20%)
  const cpt_E5 = { p_FF: 20, p_FT: 80, p_TF: 80, p_TT: 99 };
  await instance.impostaCPT(5, cpt_E5, { from: indirizzoOracolo });

  console.log("Setup delle CPT per E1-E5 completato.");
  console.log("----------------------------------------------------");
};
// Importa il file .json del contratto compilato (artifact)
/*
const OracoloCatenaFreddo = artifacts.require("OracoloCatenaFreddo");

module.exports = async function (deployer, network, accounts) {
  
  // Scegliamo quale account di Ganache useremo per simulare
  // il nostro Oracolo Off-chain.
  // NON usiamo 'accounts[0]' perché è quello che fa il deploy (msg.sender)
  // e ha già il ruolo di ADMIN.
  // Usiamo 'accounts[1]' per separare i privilegi.
  const indirizzoOracoloOffChain = accounts[1];

  console.log("----------------------------------------------------");
  console.log("Deploying OracoloCatenaFreddo...");
  console.log("Account dell'Oracolo Off-chain (RUOLO_ORACOLO):", indirizzoOracoloOffChain);
  console.log("----------------------------------------------------");

  // Fai il deploy del contratto.
  // Passiamo 'indirizzoOracoloOffChain' al costruttore del contratto,
  // che lo userà per assegnare il RUOLO_ORACOLO.
  await deployer.deploy(OracoloCatenaFreddo, indirizzoOracoloOffChain);

  // Opzionale: stampa l'indirizzo del contratto deployato
  const contrattoDeployato = await OracoloCatenaFreddo.deployed();
  console.log("Contratto OracoloCatenaFreddo deployato a:", contrattoDeployato.address);
};
*/