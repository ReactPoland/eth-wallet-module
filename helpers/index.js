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

export const isTooLongDataToEncryptProblem = (error) => {
    const errorMsg = fetchErrorMessage(error);
    const problemsFilter = 'input must be under 256 bytes';
    const isProblem = errorMsg.toLowerCase().indexOf(problemsFilter) !== -1;

    return isProblem
};
