/*
 * Truffle configuration file
 * Configura la connessione a Ganache e il compilatore Solidity
 */

module.exports = {
  paths: {
    contracts: "./contracts",
    migrations: "./migrations",
    artifacts: "./build/contracts",
  },

  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
      gas: 6721975,
      gasPrice: 20000000000,
      websockets: true,
      networkCheckTimeout: 10000,
      timeoutBlocks: 200
    },
  },

  compilers: {
    solc: {
      version: "0.8.20",
      settings: {              // Disabilita optimizer per evitare bug del compilatore
        optimizer: {
          enabled: false,
          runs: 200,
        },
        evmVersion: "paris"
      },
    },
  },

  // Impostazioni per i test
  mocha: {
    // timeout: 100000
  },

  // Disabilitazione di Truffle DB (non necessario per la maggior parte dei progetti)
  db: {
    enabled: false,
  },
};