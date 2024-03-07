// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../LockedPollen/LockedPollen.sol";
import "../PollenDAO/PollenDAO.sol";

contract Launcher {
    struct Campaign {
        mapping(address => bool) reUsed;
        uint256 totalApprove;
        uint256 totalReject;
        uint256 expires;
        bool passed;
        bool executed;
    }
    enum RateBase {
        Usd,
        Eth
    }

    IERC20 private immutable Pollen;
    mapping(address => uint256) private balances;
    mapping(uint256 => Campaign) public campaigns;
    address public daoAddr;
    address public vePollenAddr;
    uint256 public currentCampaign;
    address[] public assets;
    address[] public feeds;
    uint8[] private rateBases;

    uint256 public constant VOTE_PERIOD = 3 days;
    uint256 public constant REBALANCE_MIN_PERIOD = 1 hours;
    uint256 public constant MAX_NUM_ASSETS = 10;
    uint256 public constant MIN_BALANCE_POLLINATOR = 1 * 1e18;
    uint256 public constant MAX_DELEGATION = 100000 * 1e18;
    uint256 public constant BOOST_SCALE = 0.2 * 1e18;
    uint256 public constant MAX_WITHDRAWALS = 10;
    uint256 public constant GOV_QUORUM = 200; // 0.2
    uint256 public constant GOV_VOTING_PERIOD = 1 weeks;
    uint256 public constant GOV_TIME_LOCK = 1 weeks;

    IssuanceInfo[] public issuanceSchedule;

    // predeployed modules
    address public quoterAddr;
    address public portfolioAddr;
    address public governanceAddr;
    address public minterAddr;

    bool public launched = false;

    event Vote(address indexed voter, uint256 amount, bool voteType);
    event ReVote(address indexed voter, uint256 amount, bool voteType);
    event NewCampaign();
    event CampaignValidated(bool passed);
    event DaoLaunched(address daoAddr);
    event ClaimedTokens(address indexed voter, uint256 amount);

    struct ModulesInfo {
        bytes4[] quoterSelectors;
        bytes4[] portfolioSelectors;
        bytes4[] minterSelectors;
        bytes4[] governanceSelectors;
        address quoterAddr;
        address portfolioAddr;
        address minterAddr;
        address governanceAddr;
        address daoAdminAddr;
        uint256[] benchMark;
    }

    ModulesInfo public mInfo;

    constructor(
        address plnAddress_,
        address[] memory assets_,
        address[] memory feeds_,
        uint8[] memory rateBases_,
        IssuanceInfo[] memory issuanceSchedule_,
        ModulesInfo memory mInfo_
    ) {
        Pollen = IERC20(plnAddress_);
        campaigns[currentCampaign].expires = block.timestamp + VOTE_PERIOD;
        assets = assets_;
        rateBases = rateBases_;
        feeds = feeds_;
        mInfo = mInfo_;
        for (uint256 i = 0; i < issuanceSchedule_.length; i++) {
            issuanceSchedule.push(issuanceSchedule_[i]);
        }
    }

    modifier whileNotLaunched() {
        require(!launched, "Pollen DAO has been lauched");
        _;
    }

    // External functions

    /// @notice vote using PLN tokens on the current active campaign
    /// @param amount amount of pollen to use for voting
    /// @param voteOption bool for approve or rejecting a campaign
    function vote(uint256 amount, bool voteOption) external whileNotLaunched {
        require(amount != 0, "Zero vote amount");
        Campaign storage c = campaigns[currentCampaign];
        require(c.expires > block.timestamp, "Campaign finished");

        if (voteOption) c.totalApprove += amount;
        else c.totalReject += amount;

        balances[msg.sender] += amount;
        c.reUsed[msg.sender] = true;

        require(
            Pollen.transferFrom(msg.sender, address(this), amount),
            "Token Transfer failed"
        );
        emit Vote(msg.sender, amount, voteOption);
    }

    /// @notice allows a voter to re-use votes for other campaigns
    /// @param voteOption bool for approve or reject a campaign
    function reUseVotes(bool voteOption) external whileNotLaunched {
        Campaign storage c = campaigns[currentCampaign];
        require(c.expires > block.timestamp, "Campaign finished");
        require(!c.reUsed[msg.sender], "Already reused tokens");

        uint256 amount = balances[msg.sender];
        require(amount != 0, "No votes to re-use");

        if (voteOption) c.totalApprove += amount;
        else c.totalReject += amount;
        c.reUsed[msg.sender] = true;

        emit ReVote(msg.sender, amount, voteOption);
    }

    // @notice sets a new campaign and updates the expiry time of that campaign
    function startCampaign() external whileNotLaunched {
        Campaign storage c = campaigns[currentCampaign];
        require(c.executed && !c.passed, "Active campaign");
        currentCampaign++;
        campaigns[currentCampaign].expires = block.timestamp + VOTE_PERIOD;
        emit NewCampaign();
    }

    /// @notice user can claim tokens which were used for voting
    function claimTokens() external {
        Campaign storage c = campaigns[currentCampaign];
        if (c.reUsed[msg.sender]) {
            require(c.expires < block.timestamp, "User vote is active");
        }
        uint256 amount = balances[msg.sender];
        require(amount != 0, "No tokens to claim");
        delete balances[msg.sender];
        require(Pollen.transfer(msg.sender, amount), "transfer failed");
        emit ClaimedTokens(msg.sender, amount);
    }

    /// @notice checks if a campaign is active and launches the campaign if is got approved
    /// @param campaignId id of campaign to validate and launch
    function validateCampaign(uint256 campaignId) external whileNotLaunched {
        require(campaignId <= currentCampaign);
        Campaign storage c = campaigns[campaignId];
        require(c.expires < block.timestamp, "Campaign active");
        c.executed = true;
        if (c.totalApprove > c.totalReject) {
            c.passed = true;
            (address dao, address vePollen) = launch();
            daoAddr = dao;
            vePollenAddr = vePollen;
            launched = true;
            emit DaoLaunched(dao);
        } else {
            c.passed = false;
        }
        emit CampaignValidated(c.passed);
    }

    // Private functions

    /// @notice creates a new dao and lockedPollen contracts with associated modules and populates dao configs
    /// @return the new dao and vePln addresses
    function launch() private returns (address, address) {
        // Launche DAO core and vePLN contracts
        PollenDAO dao = new PollenDAO();
        LockedPollen vePollen = new LockedPollen(address(dao), address(Pollen));

        // Add modules previously launched
        dao.addModule(address(mInfo.quoterAddr), mInfo.quoterSelectors);
        dao.addModule(address(mInfo.portfolioAddr), mInfo.portfolioSelectors);
        dao.addModule(address(mInfo.minterAddr), mInfo.minterSelectors);
        dao.addModule(address(mInfo.governanceAddr), mInfo.governanceSelectors);

        // Configure DAO modules
        IPollenDAO idao = IPollenDAO(address(dao));

        // set token addresses PLN and vePLN
        idao.setPollenTokens(address(Pollen), address(vePollen));

        //Portfolio parameters
        uint256 n = assets.length;
        for (uint256 i = 0; i < n; i++) {
            idao.addAsset(assets[i]);
        }
        idao.setRebalancePeriod(REBALANCE_MIN_PERIOD);
        idao.setMaxNumberOfAssetsPerPortfolio(MAX_NUM_ASSETS);
        idao.setLimitPortfolioBalance(MIN_BALANCE_POLLINATOR, MAX_DELEGATION);

        //Quoter aparmeters
        idao.addPriceFeeds(rateBases, assets, feeds);

        //Minter Parameters
        idao.setBoostingScale(BOOST_SCALE);
        idao.setMaxNumberWithdrawls(MAX_WITHDRAWALS);
        idao.initializeIssuanceInfo(issuanceSchedule);

        //Governance Parameters
        idao.setQuorum(GOV_QUORUM);
        idao.setVotingPeriod(GOV_VOTING_PERIOD);
        idao.setTimeLock(GOV_TIME_LOCK);

        // create benchmark portfolio
        idao.createBenchMarkPortfolio(mInfo.benchMark);

        // DAO Admin
        dao.transferAdminRole(mInfo.daoAdminAddr);

        return (address(dao), address(vePollen));
    }
}
