// Importa il nuovo contratto
const BNCalcolatoreOnChain = artifacts.require("BNCalcolatoreOnChain");
const { expectRevert } = require('@openzeppelin/test-helpers');

contract("BNCalcolatoreOnChain", (accounts) => {

    // Attori
    const adminOracolo = accounts[0]; // Chi fa setup CPT
    const sensore = accounts[1];
    const mittente = accounts[2];
    const corriere = accounts[3];
    const attaccante = accounts[4];

    let instance;

    // Definiamo le CPT che useremo nei test (copiate dal file migration)
    const PRECISIONE = 100;
    const cpt_E1 = { p_FF: 5, p_FT: 5, p_TF: 98, p_TT: 98 }; // Temp
    const cpt_E2 = { p_FF: 1, p_FT: 99, p_TF: 1, p_TT: 99 }; // Sigillo
    const cpt_E3 = { p_FF: 70, p_FT: 10, p_TF: 70, p_TT: 10 }; // Shock
    const cpt_E4 = { p_FF: 95, p_FT: 2, p_TF: 95, p_TT: 2 }; // Luce
    const cpt_E5 = { p_FF: 20, p_FT: 80, p_TF: 80, p_TT: 99 }; // Scan

    // Funzione helper per fare il setup del contratto prima di ogni test
    beforeEach(async () => {
        // 1. Deploy
        instance = await BNCalcolatoreOnChain.new({ from: adminOracolo });
        
        // 2. Assegna Ruoli
        await instance.grantRole(await instance.RUOLO_SENSORE(), sensore, { from: adminOracolo });
        await instance.grantRole(await instance.RUOLO_MITTENTE(), mittente, { from: adminOracolo });

        // 3. Setup CPT (fondamentale per i calcoli)
        await instance.impostaProbabilitaAPriori(90, 90, { from: adminOracolo });
        await instance.impostaCPT(1, cpt_E1, { from: adminOracolo });
        await instance.impostaCPT(2, cpt_E2, { from: adminOracolo });
        await instance.impostaCPT(3, cpt_E3, { from: adminOracolo });
        await instance.impostaCPT(4, cpt_E4, { from: adminOracolo });
        await instance.impostaCPT(5, cpt_E5, { from: adminOracolo });
    });


    // --- TEST 1: FLUSSO CORRETTO (SUCCESS PATH) ---
    it("dovrebbe pagare il corriere se tutte le evidenze sono positive", async () => {
        
        // 1. Mittente crea spedizione
        const importo = web3.utils.toWei("1", "ether");
        await instance.creaSpedizione(corriere, { from: mittente, value: importo });
        const idSpedizione = 1;

        // 2. Sensore invia evidenze "BUONE"
        // (E1=T, E2=T, E3=F, E4=F, E5=T)
        // (Valori 'T/F' scelti per massimizzare la probabilità)
        await instance.inviaEvidenza(idSpedizione, 1, true,  { from: sensore }); // Temp OK
        await instance.inviaEvidenza(idSpedizione, 2, true,  { from: sensore }); // Sigillo OK
        await instance.inviaEvidenza(idSpedizione, 3, false, { from: sensore }); // No Shock
        await instance.inviaEvidenza(idSpedizione, 4, false, { from: sensore }); // No Luce
        await instance.inviaEvidenza(idSpedizione, 5, true,  { from: sensore }); // Scan OK

        // 3. Corriere chiama 'validaEPaga'
        // Controlliamo il bilancio PRIMA
        const bilancioPrima = await web3.eth.getBalance(corriere);
        
        // Non ci aspettiamo un revert
        await instance.validaEPaga(idSpedizione, { from: corriere });

        // 4. (Assert) Verifichiamo che il corriere sia stato pagato
        const bilancioDopo = await web3.eth.getBalance(corriere);
        assert.isTrue(web3.utils.toBN(bilancioDopo).gt(web3.utils.toBN(bilancioPrima)), "Il corriere non e' stato pagato");
    });

    // --- TEST 2: MONITOR DI SAFETY (CALCOLO ON-CHAIN) ---
    it("NON dovrebbe pagare se un'evidenza critica fallisce (es. E4 Luce)", async () => {
        
        // 1. Crea spedizione
        const importo = web3.utils.toWei("1", "ether");
        await instance.creaSpedizione(corriere, { from: mittente, value: importo });
        const idSpedizione = 1;

        // 2. Sensore invia evidenze "BUONE" (E1,E2,E3,E5)
        await instance.inviaEvidenza(idSpedizione, 1, true,  { from: sensore }); // Temp OK
        await instance.inviaEvidenza(idSpedizione, 2, true,  { from: sensore }); // Sigillo OK
        await instance.inviaEvidenza(idSpedizione, 3, false, { from: sensore }); // No Shock
        await instance.inviaEvidenza(idSpedizione, 5, true,  { from: sensore }); // Scan OK
        
        // ... MA INVIA UN'EVIDENZA "CATTIVA"
        await instance.inviaEvidenza(idSpedizione, 4, true,  { from: sensore }); // 🆘 Allarme LUCE! Pacco aperto!

        // 3. (Act & Assert)
        // Ci aspettiamo che il calcolo on-chain fallisca il 'require'
        await expectRevert(
            instance.validaEPaga(idSpedizione, { from: corriere }),
            "Requisiti di conformita non superati"
        );
    });

    // --- TEST 3: SICUREZZA (ACCESS CONTROL) ---
    it("NON dovrebbe permettere a un attaccante di inviare evidenze", async () => {
        
        await instance.creaSpedizione(corriere, { from: mittente, value: web3.utils.toWei("1", "ether") });
        const idSpedizione = 1;

        // 'attaccante' (accounts[4]) prova a inviare evidenza
        // Diciamo al test di aspettarsi "qualsiasi" tipo di revert,
        // perché sappiamo che AccessControl non viene decodificato bene.
        await expectRevert.unspecified(
            instance.inviaEvidenza(idSpedizione, 1, true,  { from: attaccante })
        );
    });

    // --- TEST 4: INTEGRITÀ DATI (Evidenze mancanti) ---
    it("NON dovrebbe pagare se mancano delle evidenze", async () => {
        
        await instance.creaSpedizione(corriere, { from: mittente, value: web3.utils.toWei("1", "ether") });
        const idSpedizione = 1;

        // Invia solo 4 evidenze su 5
        await instance.inviaEvidenza(idSpedizione, 1, true, { from: sensore });
        await instance.inviaEvidenza(idSpedizione, 2, true, { from: sensore });
        await instance.inviaEvidenza(idSpedizione, 3, false, { from: sensore });
        await instance.inviaEvidenza(idSpedizione, 4, false, { from: sensore });
        // Manca E5

        // Prova a pagare
        await expectRevert(
            instance.validaEPaga(idSpedizione, { from: corriere }),
            "Evidenze mancanti"
        );
    });
});


/*

// Importa gli "artifact" (il contratto compilato)
const OracoloCatenaFreddo = artifacts.require("OracoloCatenaFreddo");

// Importa le utility per testare gli errori (che hai appena installato)
const { expectRevert } = require('@openzeppelin/test-helpers');

// Inizia la suite di test
contract("OracoloCatenaFreddo", (accounts) => {

    // Definiamo gli attori che useremo. Truffle ci dà 10 account (accounts[0], accounts[1], ...)
    const admin = accounts[0];        // Chi ha deployato il contratto
    const indirizzoOracolo = accounts[1]; // L'oracolo off-chain (come da file 'migrations')
    const mittente = accounts[2];   // L'azienda che spedisce (lo impostiamo)
    const corriere = accounts[3];   // Il corriere
    const utenteACaso = accounts[4];  // Un utente malevolo o maldestro

    let contrattoOracolo;

    // 'beforeEach' viene eseguito prima di ogni "it"
    // Questo ci dà un contratto "pulito" per ogni test
    beforeEach(async () => {
        // Deploya una NUOVA istanza del contratto
        // NOTA: il 'indirizzoOracolo' qui deve corrispondere a quello della migration
        // Ma per i test, lo impostiamo qui esplicitamente per sicurezza.
        contrattoOracolo = await OracoloCatenaFreddo.new(indirizzoOracolo, { from: admin });

        // Diamo il RUOLO_MITTENTE a 'mittente' per i nostri test
        await contrattoOracolo.grantRole(await contrattoOracolo.RUOLO_MITTENTE(), mittente, { from: admin });
    });


    // --- TEST 1: FLUSSO CORRETTO (SUCCESS PATH) ---
    it("dovrebbe pagare il corriere se le probabilita sono buone (>= 95)", async () => {
        
        // 1. (Arrange) Il Mittente crea una spedizione e deposita 1 Ether
        const importo = web3.utils.toWei("1", "ether");
        await contrattoOracolo.creaSpedizione(corriere, { from: mittente, value: importo });
        const idSpedizione = 1;

        // 2. (Act) L'Oracolo (accounts[1]) invia probabilità ALTE
        await contrattoOracolo.aggiornaProbabilita(idSpedizione, 99, 99, { from: indirizzoOracolo });

        // 3. (Act) Il Corriere chiama 'validaEPaga'
        // Controlliamo il bilancio del corriere PRIMA
        const bilancioPrima = await web3.eth.getBalance(corriere);

        await contrattoOracolo.validaEPaga(idSpedizione, { from: corriere });

        // 4. (Assert) Verifichiamo che il corriere sia stato pagato
        const bilancioDopo = await web3.eth.getBalance(corriere);
        
        // Il bilancio 'dopo' deve essere maggiore di 'prima'
        // (usiamo BigNumber per comparare i valori)
        assert.isTrue(web3.utils.toBN(bilancioDopo).gt(web3.utils.toBN(bilancioPrima)), "Il corriere non e' stato pagato");
    });


    // --- TEST 2: MONITOR DI SAFETY (RUNTIME ENFORCEMENT) ---
    it("NON dovrebbe pagare il corriere se le probabilita sono basse (< 95)", async () => {
        
        // 1. (Arrange) Crea la spedizione
        const importo = web3.utils.toWei("1", "ether");
        await contrattoOracolo.creaSpedizione(corriere, { from: mittente, value: importo });
        const idSpedizione = 1;

        // 2. (Act) L'Oracolo invia probabilità BASSE (es. sensore rotto)
        await contrattoOracolo.aggiornaProbabilita(idSpedizione, 90, 99, { from: indirizzoOracolo });

        // 3. (Act & Assert)
        // Ci aspettiamo che la chiamata 'validaEPaga' fallisca (revert)
        // con il messaggio di errore che abbiamo scritto nel 'require'
        await expectRevert(
            contrattoOracolo.validaEPaga(idSpedizione, { from: corriere }),
            "Requisiti di conformita non superati" // Questo DEVE corrispondere al 'require'
        );
    });


    // --- TEST 3: SICUREZZA (ACCESS CONTROL) ---
    it("NON dovrebbe permettere a un utente a caso di aggiornare le probabilità", async () => {
        
        // 1. (Arrange) Crea la spedizione
        const importo = web3.utils.toWei("1", "ether");
        await contrattoOracolo.creaSpedizione(corriere, { from: mittente, value: importo });
        const idSpedizione = 1;

        // 2. (Act & Assert)
        // Un utente a caso (accounts[4]) prova a inviare le probabilità
        // Ci aspettiamo che fallisca perché non ha il RUOLO_ORACOLO
        await expectRevert.unspecified(
            contrattoOracolo.aggiornaProbabilita(idSpedizione, 99, 99, { from: utenteACaso })
        );
    });

});*/