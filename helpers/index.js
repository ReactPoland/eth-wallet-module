const fetchErrorMessage = (error) => {
    return error && (error.message || '');
};

export const noConnectionError = (error) => {
    const errorMsg = fetchErrorMessage(error);
    const networkProblemsFilter = 'unable to resolve host';
    const isNetworkProblem = errorMsg.toLowerCase().indexOf(networkProblemsFilter) !== -1;

    const networkProblemError = new Error('No connection to the network');
    return isNetworkProblem ? networkProblemError : error;
};
