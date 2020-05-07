export const ProposalType = { Invest: '0', Divest: '1', Last: '2' };
export const TokenType = { ERC20: '0', Last: '1' };
export const ProposalStatus = { Null: '0', Submitted: '1', Executed: '2', Last: '3' };
export const VoterState = { Null: '0', VotedYes: '1', VotedNo: '2' };
export const address0 = '0x0000000000000000000000000000000000000000';
export const Artifacts = {
    AudacityDAO: artifacts.require('AudacityDAO'),
    DAOToken: artifacts.require("DAOToken"),
    AssetToken: artifacts.require("MockERC20")
};
