import { cloneDeep, isArray } from 'lodash';

const DEBUG = false;

class ContractManager {
    constructor (web3Provider, contractAddress, contractABI) {
        if (!web3Provider) {
            throw new Error('Missing web3Provider. Not able to create ContractManager instance.');
        }

        if (!contractAddress || !contractABI) {
            throw new Error('Missing contract data. Not able to create ContractManager instance.');
        }

        this.contractAddress = contractAddress;
        this.contract = web3Provider.eth.contract(cloneDeep(contractABI)).at(contractAddress);
    }

    /**
    * receive contract address
    */
    getContractAddress = () => {
        return this.contractAddress;
    }

    /**
    * receive ABI method object of specific name
    * @param {string} name - name of the method
    */
    getAbiMethod = (name) => {
        const tAbi = this.contract.abi;
        for (const i in tAbi) {
            if (tAbi[i].name === name) {
                return tAbi[i];
            }
        }

        DEBUG && console.warn('getAbiMethod error: no ABI method of this name', name);
        return null;
    }

    validateAbiMethodArgs = (name, args) => {
        let method = null;
        const tAbi = this.contract.abi;
        for (const i in tAbi) {
            if (tAbi[i].name === name) {
                method = tAbi[i];
                break;
            }
        }

        if (!method) {
            DEBUG && console.warn('getAbiMethod error: no ABI method of this name', name);
            return null;
        }

        for (const i in method.inputs) {
            const valueToCheck = args[i];
            const typeToCheck = method.inputs[i].type;
            const nameToCheck = method.inputs[i].name;

            if (!valueToCheck) {
                throw new Error('run ' + name + ' error - missing arg - ' + typeToCheck + '| arg index - ' + i);
            }

            if (nameToCheck === 'value' && typeToCheck === 'uint256') {
                if (typeof valueToCheck !== 'string') {
                    throw new Error('run ' + name + ' error - value is not a string');
                }
                if (isNaN(parseInt(valueToCheck))) {
                    throw new Error('run ' + name + ' error - value is not numeric');
                }
            }
        }
    }

    clearValueFromAbiMethodArgs = (name, args) => {
        let method = null;
        const tAbi = this.contract.abi;
        for (const i in tAbi) {
            if (tAbi[i].name === name) {
                method = tAbi[i];
                break;
            }
        }

        if (!method) {
            DEBUG && console.warn('getAbiMethod error: no ABI method of this name', name);
            return null;
        }

        const finalArguments = [];

        for (const i in method.inputs) {
            const valueToCheck = args[i];
            const typeToCheck = method.inputs[i].type;
            const nameToCheck = method.inputs[i].name;

            if (!valueToCheck) {
                throw new Error('clearValueFromAbiMethodArgs run ' + name + ' error - missing arg - ' + typeToCheck + '| arg index - ' + i);
            }

            if (nameToCheck === 'value' && typeToCheck === 'uint256') { // get value type item
                finalArguments.push('0');
            } else {
                finalArguments.push(valueToCheck);
            }
        }

        return finalArguments;
    }

    getValueFromAbiMethodArgs = (name, args) => {
        let method = null;
        const tAbi = this.contract.abi;
        for (const i in tAbi) {
            if (tAbi[i].name === name) {
                method = tAbi[i];
                break;
            }
        }

        if (!method) {
            DEBUG && console.warn('getAbiMethod error: no ABI method of this name', name);
            return null;
        }

        for (const i in method.inputs) {
            const valueToCheck = args[i];
            const typeToCheck = method.inputs[i].type;
            const nameToCheck = method.inputs[i].name;

            if (!valueToCheck) {
                throw new Error('clearValueFromAbiMethodArgs run ' + name + ' error - missing arg - ' + typeToCheck + '| arg index - ' + i);
            }

            if (nameToCheck === 'value' && typeToCheck === 'uint256') { // get value type item
                return valueToCheck;
            }
        }

        return '0';
    }

    /**
    * receive array with ABI Contract methods names
    */
    getContractFunctionsNames = () => {
        const contractFunctionsNames = [];
        const tAbi = this.contract.abi;
        for (const i in tAbi) {
            if (tAbi[i].type === 'function') {
                contractFunctionsNames.push(tAbi[i].name);
            }
        }
        DEBUG && console.info('contractFunctionsNames', contractFunctionsNames);
        return contractFunctionsNames;
    }

    /**
    * receive array with ABI Contract methods simplified objects
    */
    getContractABI = () => {
        return cloneDeep(this.contract.abi);
    }

    /**
    * receive number data structure for give method with arguments
    * @param {string} methodName - name of the method
    * @param {array} argsArray - array with arguments
    */
    getContractMethodData = (methodName, argsArray = []) => {
        if (!methodName) {
            DEBUG && console.warn('Data from function not taken - missing one of the arguments: methodName ');
        }

        let data = null;
        if (argsArray.length > 0) {
            data = this.contract[methodName].getData(...argsArray);
        } else {
            data = this.contract[methodName].getData();
        }

        return data;
    }

    /**
    * receive data directly from contract read values
    * @param {object} abiMethodObj - method object from ABI
    * @param {string} abiMethodObj.type - type of the method
    * @param {string} abiMethodObj.name - name of the method
    * @param {bool} abiMethodObj.constant - constant type method indicator
    * @param {array} abiMethodObj.inputs - array with inputs arguments
    * @param {array} abiMethodObj.outputs - array with outputs arguments
    * @param {array} argsArray - array with arguments
    * @param {function} callback - success callback
    * @param {function} errorCallback - failure callback
    */
    runContractReadMethod = (abiMethodObj, argsArray = [], callback = () => {}, errorCallback = () => {}) => {
        const { type, name, constant, inputs, outputs } = abiMethodObj;

        if (type !== 'function' || !constant || !(isArray(outputs) && outputs.length > 0)) {
            console.warn('runContractReadFunction error - not a read contract method');
            return;
        }

        if (!isArray(inputs)) {
            console.warn('runContractReadFunction error - missing inputs array');
            return;
        }

        if (inputs.length !== argsArray.length) {
            console.warn('runContractReadFunction error - arguments number not equal to required inputs number');
            return;
        }

        const handleCallback = (error, result) => {
            if (!error) {
                callback(result);
                DEBUG && console.info(name, result.toString());
            } else {
                errorCallback(error);
                DEBUG && console.warn('runContractReadFunction error:', error.name, error.message);
            }
        };

        if (argsArray.length > 0) {
            this.contract[name].call(...argsArray, handleCallback);
        } else {
            this.contract[name].call(handleCallback);
        }
    }
};

export default ContractManager;
