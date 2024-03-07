export type VotingTerms = {
    // If new proposals may be submitted with this terms
    isEnabled: boolean,
    // If Vesting Pools are excluded from voting and quorum
    isExclPools: boolean,
    // The quorum required to pass a proposal vote in % points
    quorum: number,
    // Seconds after proposal submission until voting expires
    votingExpiryDelay: number,
    // Seconds after proposal voting expires until execution opens
    executionOpenDelay: number,
    // Seconds after proposal execution opens until execution expires
    executionExpiryDelay: number,
    // Seconds since execution opens when only the `executor` may execute
    // (has no effect for a proposal with the `executor` set to zero)
    restrictExecPeriod: number,
    // Maximum value of a proposal, in % points of the portfolio
    // (unlimited if zero)
    maxImpact: number
}