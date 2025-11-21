
const Web3 = require('web3').default || require('web3');
// Importa l'artifact del contratto
const CalcolatoreArtifact = require('./build/contracts/BNCalcolatoreOnChain.json');

// --- Configurazione ---
const GANACHE_URL = 'http://127.0.0.1:7545'; // Controlla la porta su Ganache
const web3 = new Web3(GANACHE_URL);

/**
 * Funzione per simulare un sensore.
 * Ritorna 'true' o 'false' in modo casuale.
 * Per questo esempio, diamo il 90% di probabilità di 'true' (OK)
 */
function simulaSensore() {
    return Math.random() < 0.9; // 90% 'true' (OK), 10% 'false' (FALLITO)
}

async function main() {
    console.log("Avvio Oracolo/Simulatore Sensori Off-chain...");

    try {
        // 1. Ottieni gli account e l'istanza del contratto
        const accounts = await web3.eth.getAccounts();
        
        // Indirizzi come da file 'migrations'
        const indirizzoAdmin = accounts[0];
        const indirizzoSensore = accounts[1];
        const indirizzoMittente = accounts[2];
        const indirizzoCorriere = accounts[3];

        // Trova l'indirizzo del contratto sulla rete Ganache (ID 5777)
        const networkId = await web3.eth.net.getId();
        const indirizzoContratto = CalcolatoreArtifact.networks[networkId].address;

        // Crea l'istanza del contratto
        const contratto = new web3.eth.Contract(
            CalcolatoreArtifact.abi,
            indirizzoContratto
        );

        console.log(`Contratto BayesianNetworkSimplified trovato a: ${indirizzoContratto}`);

        // --- 2. SIMULA IL MITTENTE ---
        console.log("Simulazione Mittente: creazione spedizione...");
        const importo = web3.utils.toWei("1", "ether");

        // Chiama 'creaSpedizione'
        // NOTA: usiamo .send() per transazioni che modificano lo stato
        const ricevutaCreazione = await contratto.methods.creaSpedizione(indirizzoCorriere)
            .send({ from: indirizzoMittente, value: importo, gas: 500000 });
        
        // Ottieni l'ID della spedizione dall'evento
        let idSpedizione;
        if (ricevutaCreazione.events && ricevutaCreazione.events.SpedizioneCreata) {
            idSpedizione = ricevutaCreazione.events.SpedizioneCreata.returnValues.id;
        } else {
            console.error("Evento SpedizioneCreata non trovato. Prova a usare truffle migrate --reset");
            throw new Error("Evento SpedizioneCreata non emesso");
        }
        
        console.log(`✅ Spedizione creata con ID: ${idSpedizione}`);

        // --- 3. SIMULA I SENSORI (E1-E5) ---
        console.log("Simulazione Sensori: invio evidenze una per una...");

        // Simuliamo le 5 letture (true/false)
        const E1 = simulaSensore(); // Temp
        const E2 = simulaSensore(); // Sigillo
        const E3 = !simulaSensore(); // Shock (false = OK)
        const E4 = !simulaSensore(); // Luce (false = OK)
        const E5 = simulaSensore(); // Scan

        console.log(`Valori simulati: E1:${E1}, E2:${E2}, E3:${E3}, E4:${E4}, E5:${E5}`);

        // Invia le evidenze una per una, usando l'account del SENSORE
        await contratto.methods.inviaEvidenza(idSpedizione, 1, E1).send({ from: indirizzoSensore, gas: 100000 });
        await contratto.methods.inviaEvidenza(idSpedizione, 2, E2).send({ from: indirizzoSensore, gas: 100000 });
        await contratto.methods.inviaEvidenza(idSpedizione, 3, E3).send({ from: indirizzoSensore, gas: 100000 });
        await contratto.methods.inviaEvidenza(idSpedizione, 4, E4).send({ from: indirizzoSensore, gas: 100000 });
        await contratto.methods.inviaEvidenza(idSpedizione, 5, E5).send({ from: indirizzoSensore, gas: 100000 });

        console.log("🎉 Tutte e 5 le evidenze sono state inviate on-chain.");
        console.log("Ora puoi controllare la spedizione nella 'truffle console'.");

    } catch (error) {
        console.error("\n--- ERRORE NELLO SCRIPT OFF-CHAIN ---");
        console.error(error.message);
        console.log("Controlla che Ganache sia in esecuzione e che hai lanciato 'truffle migrate --reset'.");
    }
}

// Esegui lo script
main();

/*


// Questo script simula l'Oracolo Off-chain
// Ascolta (fintamente) i sensori, calcola le probabilità e le invia
// allo smart contract sulla blockchain (Ganache).

const Web3 = require('web3').default || require('web3');
// Importa l'ABI del contratto (la sua "definizione" in JSON)
const OracoloArtifact = require('./build/contracts/OracoloCatenaFreddo.json');

// --- Configurazione ---
const GANACHE_URL = 'http://127.0.0.1:7545'; // L'URL di Ganache
const web3 = new Web3(GANACHE_URL);

// L'ID della spedizione che vogliamo aggiornare (per questo test, è 1)
// Nota: ogni esecuzione dello script crea una nuova spedizione
let ID_SPEDIZIONE_DA_AGGIORNARE = 1; 

// --- Logica di Simulazione ---

// Questa funzione SIMULA l'arrivo dei dati dai sensori (E1-E5)
// e calcola la Rete Bayesiana (per ora, un semplice 'if')
/*
function calcolaProbabilitaOffChain() {
    console.log("Simulazione: Letti dati dai sensori IoT...");
    
    // Logica finta: 1 volta su 5 la spedizione fallisce
    if (Math.random() < 0.2) {
        console.log("-> 🔴 FALLIMENTO: Sensore temperatura anomalo!");
        return { probF1: 50, probF2: 99 }; // F1 (Temp) fallita
    } else {
        console.log("-> ✅ SUCCESSO: Dati conformi.");
        return { probF1: 99, probF2: 99 }; // Tutto OK
    }
}
*/

/*
// NUOVA VERSIONE - Questa implementa la "Rete Bayesiana"
// NUOVA VERSIONE - Rete Bayesiana "Complessa" con Punteggio
function calcolaProbabilitaOffChain() {
    
    console.log("Simulazione: Avvio calcolo Rete Bayesiana...");

    // --- 1. SIMULAZIONE DELLE EVIDENZE (E1-E5) ---
    // Simuliamo le 5 evidenze in modo indipendente.
    // Ogni evidenza ha una certa probabilità di "fallire".

    // E1: Dati Temperatura (90% OK, 10% Fallito)
    let E1_Temp = (Math.random() < 0.9) ? 5 : 10; // 5=OK, 10=FUORI RANGE

    // E2: Sigillo (95% OK, 5% Fallito)
    let E2_Sigillo = (Math.random() < 0.95); // true=OK, false=ROTTO

    // E3: Shock (90% OK, 10% Fallito)
    let E3_Shock = (Math.random() > 0.9); // false=OK, true=SHOCK RILEVATO

    // E4: Luce (98% OK, 2% Fallito - molto critico)
    let E4_Luce = (Math.random() > 0.98); // false=OK, true=APERTO

    // E5: Scan Arrivo (90% OK, 10% Fallito)
    let E5_ScanArrivoInOrario = (Math.random() < 0.9); // true=OK, false=IN RITARDO


    // --- 2. IL "CERVELLO" (Calcolo Fatti F1 e F2) ---
    // Partiamo dal 100% e applichiamo penalità per ogni evidenza negativa.
    
    let probF1_Temp = 100;
    let probF2_Imballaggio = 100;

    // --- Logica per F1: Integrità Temperatura ---
    if (E1_Temp > 8 || E1_Temp < 2) {
        console.log("-> 🔴 EVIDENZA (E1): Temperatura fuori range!");
        probF1_Temp -= 80; // Penalità critica
    }

    if (E5_ScanArrivoInOrario == false) {
        console.log("-> 🟠 EVIDENZA (E5): Arrivo in ritardo!");
        // Un ritardo aumenta il RISCHIO di fallimento temperatura.
        probF1_Temp -= 20; // Penalità media
    }

    // --- Logica per F2: Integrità Imballaggio ---
    if (E2_Sigillo == false) {
        console.log("-> 🔴 EVIDENZA (E2): Sigillo rotto!");
        probF2_Imballaggio -= 50; // Penalità alta
    }

    if (E3_Shock == true) {
        console.log("-> 🟠 EVIDENZA (E3): Shock rilevato!");
        // Uno shock è un rischio, ma non una certezza di danno.
        probF2_Imballaggio -= 30; // Penalità media
    }

    if (E4_Luce == true) {
        console.log("-> 🆘 EVIDENZA (E4): Sensore luce attivato! (Pacco aperto)");
        // Questa è la prova definitiva di manomissione.
        probF2_Imballaggio -= 90; // Penalità critica
    }
    
    // --- 3. NORMALIZZAZIONE (Non scendere sotto 0) ---
    if (probF1_Temp < 0) probF1_Temp = 0;
    if (probF2_Imballaggio < 0) probF2_Imballaggio = 0;

    console.log(`Risultato Calcolo: F1=${probF1_Temp}%, F2=${probF2_Imballaggio}%`);
    
    // --- 4. RITORNA I FATTI (F1, F2) ---
    // Lo script invierà solo questo risultato finale allo Smart Contract
    return { probF1: probF1_Temp, probF2: probF2_Imballaggio };
}

async function inviaProbabilitaOnChain(probF1, probF2) {
    console.log(`Tentativo di invio: F1=${probF1}, F2=${probF2}`);

    try {
        // 1. Ottieni gli account di Ganache
        const accounts = await web3.eth.getAccounts();
        const accountMittente = accounts[0];     // Deployer / RUOLO_MITTENTE
        const indirizzoOracolo = accounts[1];    // RUOLO_ORACOLO
        const corriere = accounts[3];             // Corriere (qualsiasi account va bene)
        const indirizzoContratto = OracoloArtifact.networks['5777'].address; // 5777 è l'ID network di Ganache

        // 2. Crea l'istanza del contratto
        const contratto = new web3.eth.Contract(
            OracoloArtifact.abi,
            indirizzoContratto
        );

        // 3. Crea una NUOVA spedizione ogni volta
        console.log(`Creazione nuova spedizione...`);
        const importo = web3.utils.toWei("1", "ether");
        
        const receipt = await contratto.methods.creaSpedizione(corriere)
            .send({ 
                from: accountMittente, 
                value: importo,
                gas: 300000 
            });
        
        // Ottieni l'ID della spedizione appena creata dall'evento SpedizioneCreata
        const event = receipt.events.SpedizioneCreata;
        const newIdSpedizione = event.returnValues.id;
        
        console.log(`✅ Spedizione creata con ID: ${newIdSpedizione}`);

        // 4. Chiama la funzione 'aggiornaProbabilita' con il nuovo ID
        await contratto.methods.aggiornaProbabilita(
            newIdSpedizione,
            probF1,
            probF2
        ).send({ from: indirizzoOracolo, gas: 300000 });

        console.log("🎉 Aggiornamento probabilità inviato con successo!");

    } catch (error) {
        console.error("Errore durante l'invio della transazione:", error.message);
        if (error.data) {
            console.error("Dettagli errore:", error.data);
        }
    }
}

// --- Esecuzione Principale ---
async function main() {
    console.log("Avvio Oracolo Off-chain...");
    
    // 1. Simula il calcolo Bayesiano
    const { probF1, probF2 } = calcolaProbabilitaOffChain();
    
    // 2. Invia i dati On-chain
    await inviaProbabilitaOnChain(probF1, probF2);
}

main();*/