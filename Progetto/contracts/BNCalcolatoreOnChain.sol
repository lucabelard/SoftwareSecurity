// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BNCalcolatoreOnChain
 * @notice Versione COMPLETA. Gestisce 5 Fatti e 5 Evidenze.
 * @dev Corretto per il bug del compilatore (rimossa funzione annidata)
 */
contract BNCalcolatoreOnChain is AccessControl {

    // === COSTANTI E RUOLI ===
    uint256 public constant PRECISIONE = 100;
    bytes32 public constant RUOLO_ORACOLO = keccak256("RUOLO_ORACOLO");
    bytes32 public constant RUOLO_SENSORE = keccak256("RUOLO_SENSORE");
    bytes32 public constant RUOLO_MITTENTE = keccak256("RUOLO_MITTENTE");
    uint8 public constant SOGLIA_PROBABILITA = 95; // 95%

    // === 1. MEMORIA PER LE PROBABILITÀ (CPT) ===
    uint256 public p_F1_T; // P(F1=True)
    uint256 public p_F2_T; // P(F2=True)

    struct CPT {
        uint256 p_FF; // P(E=T | F1=F, F2=F)
        uint256 p_FT; // P(E=T | F1=F, F2=T)
        uint256 p_TF; // P(E=T | F1=T, F2=F)
        uint256 p_TT; // P(E=T | F1=T, F2=T)
    }

    CPT public cpt_E1;
    CPT public cpt_E2;
    CPT public cpt_E3;
    CPT public cpt_E4;
    CPT public cpt_E5;

    // === 2. FUNZIONE DI SETUP ===
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RUOLO_ORACOLO, msg.sender);
        _grantRole(RUOLO_MITTENTE, msg.sender);
        _grantRole(RUOLO_SENSORE, msg.sender);
    }
    
    function impostaProbabilitaAPriori(uint256 _p_F1_T, uint256 _p_F2_T)
        external
        onlyRole(RUOLO_ORACOLO)
    {
        p_F1_T = _p_F1_T;
        p_F2_T = _p_F2_T;
    }

    function impostaCPT(uint8 _idEvidenza, CPT calldata _cpt)
        external
        onlyRole(RUOLO_ORACOLO)
    {
        if (_idEvidenza == 1) cpt_E1 = _cpt;
        else if (_idEvidenza == 2) cpt_E2 = _cpt;
        else if (_idEvidenza == 3) cpt_E3 = _cpt;
        else if (_idEvidenza == 4) cpt_E4 = _cpt;
        else if (_idEvidenza == 5) cpt_E5 = _cpt;
        else revert("ID evidenza non valido (1-5)");
    }

    // === 3. MEMORIA PER LE SPEDIZIONI E LE EVIDENZE ===
    enum StatoSpedizione { InAttesa, Pagata }

    struct StatoEvidenze {
        bool E1_ricevuta;
        bool E2_ricevuta;
        bool E3_ricevuta;
        bool E4_ricevuta;
        bool E5_ricevuta;
        bool E1_valore; // True o False
        bool E2_valore;
        bool E3_valore;
        bool E4_valore;
        bool E5_valore;
    }

    struct Spedizione {
        address mittente;
        address corriere;
        uint256 importoPagamento;
        StatoSpedizione stato;
        StatoEvidenze evidenze;
    }

    mapping(uint256 => Spedizione) public spedizioni;
    uint256 private _contatoreIdSpedizione;

    event SpedizioneCreata(uint256 indexed id, address indexed mittente, address indexed corriere);
    event SpedizionePagata(uint256 indexed id, address indexed corriere, uint256 importo);

    function creaSpedizione(address _corriere)
        external
        payable
        onlyRole(RUOLO_MITTENTE)
        returns (uint256)
    {
        require(msg.value > 0, "Pagamento > 0");
        _contatoreIdSpedizione++;
        uint256 id = _contatoreIdSpedizione;
        spedizioni[id] = Spedizione({
            mittente: msg.sender,
            corriere: _corriere,
            importoPagamento: msg.value,
            stato: StatoSpedizione.InAttesa,
            evidenze: StatoEvidenze(false,false,false,false,false,false,false,false,false,false)
        });

        emit SpedizioneCreata(id, msg.sender, _corriere);
        return id;
    }

    // === 4. FUNZIONI DI INVIO EVIDENZE (COMPLETATA) ===
    function inviaEvidenza(uint256 _idSpedizione, uint8 _idEvidenza, bool _valore)
        external
        onlyRole(RUOLO_SENSORE)
    {
        Spedizione storage s = spedizioni[_idSpedizione];
        require(s.stato == StatoSpedizione.InAttesa, "Spedizione non in attesa");
        
        if (_idEvidenza == 1) {
            s.evidenze.E1_ricevuta = true;
            s.evidenze.E1_valore = _valore;
        } else if (_idEvidenza == 2) {
            s.evidenze.E2_ricevuta = true;
            s.evidenze.E2_valore = _valore;
        } else if (_idEvidenza == 3) {
            s.evidenze.E3_ricevuta = true;
            s.evidenze.E3_valore = _valore;
        } else if (_idEvidenza == 4) {
            s.evidenze.E4_ricevuta = true;
            s.evidenze.E4_valore = _valore;
        } else if (_idEvidenza == 5) {
            s.evidenze.E5_ricevuta = true;
            s.evidenze.E5_valore = _valore;
        } else revert("ID evidenza non valido (1-5)");
    }

    // === 5. IL CALCOLATORE (CORRETTO SENZA NESTING) ===
    
    function _leggiValoreCPT(bool _valEvidenza, uint256 _p_T) internal pure returns (uint256) {
        if (_valEvidenza == true) {
            return _p_T; // Ritorna P(E=T | ...)
        } else {
            return PRECISIONE - _p_T; // Ritorna P(E=F | ...)
        }
    }

    /**
     * @notice Funzione "appiattita" per evitare il bug del compilatore solc
     */
    function _calcolaProbabilitaCombinata(StatoEvidenze memory _evidenze, bool _f1, bool _f2) 
        internal view returns (uint256) 
    {
        uint256 probCombinata = PRECISIONE; 
        uint256 p_T; // Probabilità P(E=T | F1, F2)
        uint256 p_e; // Probabilità finale dell'evidenza (T or F)

        // --- Logica E1 ---
        if (_evidenze.E1_ricevuta) {
            if (_f1 == false && _f2 == false) p_T = cpt_E1.p_FF;
            else if (_f1 == false && _f2 == true)  p_T = cpt_E1.p_FT;
            else if (_f1 == true  && _f2 == false) p_T = cpt_E1.p_TF;
            else if (_f1 == true  && _f2 == true)  p_T = cpt_E1.p_TT;
            p_e = _leggiValoreCPT(_evidenze.E1_valore, p_T);
            probCombinata = (probCombinata * p_e) / PRECISIONE;
        }
        
        // --- Logica E2 ---
        if (_evidenze.E2_ricevuta) {
            if (_f1 == false && _f2 == false) p_T = cpt_E2.p_FF;
            else if (_f1 == false && _f2 == true)  p_T = cpt_E2.p_FT;
            else if (_f1 == true  && _f2 == false) p_T = cpt_E2.p_TF;
            else if (_f1 == true  && _f2 == true)  p_T = cpt_E2.p_TT;
            p_e = _leggiValoreCPT(_evidenze.E2_valore, p_T);
            probCombinata = (probCombinata * p_e) / PRECISIONE;
        }
        
        // --- Logica E3 ---
        if (_evidenze.E3_ricevuta) {
            if (_f1 == false && _f2 == false) p_T = cpt_E3.p_FF;
            else if (_f1 == false && _f2 == true)  p_T = cpt_E3.p_FT;
            else if (_f1 == true  && _f2 == false) p_T = cpt_E3.p_TF;
            else if (_f1 == true  && _f2 == true)  p_T = cpt_E3.p_TT;
            p_e = _leggiValoreCPT(_evidenze.E3_valore, p_T);
            probCombinata = (probCombinata * p_e) / PRECISIONE;
        }
        
        // --- Logica E4 ---
        if (_evidenze.E4_ricevuta) {
            if (_f1 == false && _f2 == false) p_T = cpt_E4.p_FF;
            else if (_f1 == false && _f2 == true)  p_T = cpt_E4.p_FT;
            else if (_f1 == true  && _f2 == false) p_T = cpt_E4.p_TF;
            else if (_f1 == true  && _f2 == true)  p_T = cpt_E4.p_TT;
            p_e = _leggiValoreCPT(_evidenze.E4_valore, p_T);
            probCombinata = (probCombinata * p_e) / PRECISIONE;
        }
        
        // --- Logica E5 ---
        if (_evidenze.E5_ricevuta) {
            if (_f1 == false && _f2 == false) p_T = cpt_E5.p_FF;
            else if (_f1 == false && _f2 == true)  p_T = cpt_E5.p_FT;
            else if (_f1 == true  && _f2 == false) p_T = cpt_E5.p_TF;
            else if (_f1 == true  && _f2 == true)  p_T = cpt_E5.p_TT;
            p_e = _leggiValoreCPT(_evidenze.E5_valore, p_T);
            probCombinata = (probCombinata * p_e) / PRECISIONE;
        }

        return probCombinata;
    }

    function _calcolaProbabilitaPosteriori(uint256 _id) 
        internal view 
        returns (uint256, uint256) 
    {
        StatoEvidenze memory evidenze = spedizioni[_id].evidenze;
        
        uint256 pF1_T = p_F1_T;
        uint256 pF1_F = PRECISIONE - pF1_T;
        uint256 pF2_T = p_F2_T;
        uint256 pF2_F = PRECISIONE - pF2_T;

        // 1. Termine TT: P(E | T,T) * P(T) * P(T)
        uint256 termine_TT = _calcolaProbabilitaCombinata(evidenze, true, true);
        termine_TT = (termine_TT * pF1_T * pF2_T) / (PRECISIONE * PRECISIONE);

        // 2. Termine TF: P(E | T,F) * P(T) * P(F)
        uint256 termine_TF = _calcolaProbabilitaCombinata(evidenze, true, false);
        termine_TF = (termine_TF * pF1_T * pF2_F) / (PRECISIONE * PRECISIONE);
        
        // 3. Termine FT: P(E | F,T) * P(F) * P(T)
        uint256 termine_FT = _calcolaProbabilitaCombinata(evidenze, false, true);
        termine_FT = (termine_FT * pF1_F * pF2_T) / (PRECISIONE * PRECISIONE);

        // 4. Termine FF: P(E | F,F) * P(F) * P(F)
        uint256 termine_FF = _calcolaProbabilitaCombinata(evidenze, false, false);
        termine_FF = (termine_FF * pF1_F * pF2_F) / (PRECISIONE * PRECISIONE);

        uint256 normalizzatore = termine_TT + termine_TF + termine_FT + termine_FF;
        
        if (normalizzatore == 0) return (0, 0);

        // P(F1=T | E) = (termine_TT + termine_TF) / normalizzatore
        uint256 probF1_True = ((termine_TT + termine_TF) * PRECISIONE) / normalizzatore;

        // P(F2=T | E) = (termine_TT + termine_FT) / normalizzatore
        uint256 probF2_True = ((termine_TT + termine_FT) * PRECISIONE) / normalizzatore;

        return (probF1_True, probF2_True);
    }

    // === 6. FUNZIONE DI PAGAMENTO (COMPLETATA) ===
    
    function validaEPaga(uint256 _id) external {
        Spedizione storage s = spedizioni[_id];
        require(s.corriere == msg.sender, "Non sei il corriere");
        require(s.stato == StatoSpedizione.InAttesa, "Spedizione non in attesa");
        
        require(
            s.evidenze.E1_ricevuta && s.evidenze.E2_ricevuta &&
            s.evidenze.E3_ricevuta && s.evidenze.E4_ricevuta &&
            s.evidenze.E5_ricevuta, 
            "Evidenze mancanti"
        );
        
        (uint256 probF1, uint256 probF2) = _calcolaProbabilitaPosteriori(_id);
        
        require(
            probF1 >= SOGLIA_PROBABILITA && probF2 >= SOGLIA_PROBABILITA,
            "Requisiti di conformita non superati"
        );
        
        uint256 importo = s.importoPagamento;
        s.stato = StatoSpedizione.Pagata; 

        emit SpedizionePagata(_id, s.corriere, importo);

        (bool success, ) = s.corriere.call{value: importo}("");
        require(success, "Pagamento fallito");
    }
}