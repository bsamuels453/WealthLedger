/**
 * Asset pool.
 * Deposits and withdrawals may be added to the pool and subsequently matched and processed.
 */
var AssetPool = class AssetPool {

  /**
   * Sets the asset and initializes an empty array to contain the asset deposits.
   * @param {Asset} asset - the asset.
   * @param {AssetTraker} assetTracker - The asset tracker to which the asset pool belongs.
   */
  constructor(asset, assetTracker) {

    /**
     * The asset.
     * @type {Asset}
     */
    this.asset = asset;

    /**
     * The asset tracker to which the asset pool belongs.
     * @type {AssetTraker}
     */
    this.assetTracker = assetTracker;

    /**
     * The collection of pool deposits.
     * @type {Array<PoolDeposit>}
     */
    this.poolDeposits = [];

    /**
     * The collection of pool withdrawals.
     * @type {Array<PoolDeposit>}
     */
    this.poolWithdrawals = [];

    /**
     * The collection of closed pool lots each consisting of a matched pool deposit and pool withdrawal.
     * @type {Array<PoolDeposit>}
     */
    this.closedPoolLots = [];
  }

  /**
   * The balance in the pool in subunits.
   * @type {number}
   */
  get subunits() {

    let amountSubunits = 0;
    let feeSubunits = 0;

    for (let poolDeposit of this.poolDeposits) {
      amountSubunits += poolDeposit.creditAmountSubunits;
      feeSubunits += poolDeposit.creditFeeSubunits;
    }

    for (let poolWithdrawal of this.poolWithdrawals) {
      amountSubunits -= poolWithdrawal.debitAmountSubunits;
      feeSubunits += poolWithdrawal.debitFeeSubunits;
    }

    return amountSubunits - feeSubunits;
  }

  /**
   * Adds a pool deposit to the pool.
   * Merges the non-split pool deposit with the last non-split pool deposit if they have the same date.
   * Otherwise simply adds the pool deposit to the collection of pool deposits.
   * @param {PoolDeposit} poolDeposit - the pool deposit to add.
   */
  addPoolDeposit(poolDeposit) {

    //If the deposit has zero balance close it straight away
    if (poolDeposit.action === 'Trade' && poolDeposit.subunits === 0) {
      let poolWithdrawal = new PoolWithdrawal(poolDeposit.date, poolDeposit.creditAsset, poolDeposit.balance, 0, this.assetTracker.fiatBase, 0, 0, 'Trade');
      let closedPoolLot = new ClosedPoolLot(poolDeposit, poolWithdrawal);
      this.closedPoolLots.push(closedPoolLot);
      return;
    }

    if (poolDeposit.action !== 'Split') {

      let reversePoolDeposits = this.poolDeposits.slice().reverse();

      for (let testPoolDeposit of reversePoolDeposits) {

        if (poolDeposit.date.getTime() === testPoolDeposit.date.getTime()) {

          if (testPoolDeposit.action !== 'Split') {

            testPoolDeposit.merge(poolDeposit);

            return;
          }
        }
        else {

          break;
        }
      }
    }
    this.poolDeposits.push(poolDeposit);
  }

  /**
   * Adds a pool withdrawal to the pool.
   * If the withdrawal action is not transfer, fee, and split merges the pool withdrawal with the last pool withdrawal with the same date and action if one is found.
   * Otherwise simply adds the pool withdrawal to the collection of pool withdrawals.
   * @param {PoolWithdrawal} poolWithdrawal - the pool withdrawal to add.
   */
  addPoolWithdrawal(poolWithdrawal) {

    if (poolWithdrawal.action === 'Trade' && poolWithdrawal.subunits === 0) {
      let poolDeposit = new PoolDeposit(poolWithdrawal.date, this.assetTracker.fiatBase, 0, 0, poolWithdrawal.debitAsset, poolWithdrawal.balance, 0, 'Trade');
      let closedPoolLot = new ClosedPoolLot(poolDeposit, poolWithdrawal);
      this.closedPoolLots.push(closedPoolLot);
      return;
    }

    if (poolWithdrawal.action !== 'Transfer' && poolWithdrawal.action !== 'Fee' && poolWithdrawal.action !== 'Split') {

      let reversedPoolWithrawals = this.poolWithdrawals.slice().reverse();

      for (let testPoolWithdrawal of reversedPoolWithrawals) {

        if (poolWithdrawal.date.getTime() === testPoolWithdrawal.date.getTime()) {

          if (poolWithdrawal.action === testPoolWithdrawal.action) {

            testPoolWithdrawal.merge(poolWithdrawal);

            return;
          }
        }
        else {

          break;
        }
      }
    }
    this.poolWithdrawals.push(poolWithdrawal);
  }

  /**
   * Matches the pool withrawals with the pool deposits and processes the results.
   * Matches first according to the same day rule.
   * Then matches according to the 30 day rule.
   * Then matches the remaining pool withdrawals with a merge of the pool deposits up to the date of each pool withdrawal.
   * Then merges the remaining pool deposits.
   */
  match() {

    while (this.matchSameDay());

    while (this.match30Days());

    while (this.matchPool());

    this.mergePoolDeposits();
  }

  /**
   * Matches the pool withrawals with the pool deposits according to the same day rule and processes the results.
   * Returns when the first match is found or options are exhausted.
   * @return {boolean} Whether a match was found.
   */
  matchSameDay() {

    for (let poolWithdrawal of this.poolWithdrawals) {

      if (poolWithdrawal.action !== 'Transfer' && poolWithdrawal.action !== 'Fee' && poolWithdrawal.action !== 'Split') {

        for (let poolDeposit of this.poolDeposits) {

          if (poolDeposit.action !== 'Split' && poolDeposit.action !== 'Gift' && poolDeposit.action !== 'Income') {

            if (poolWithdrawal.date.getTime() === poolDeposit.date.getTime()) {

              this.matchFound(poolWithdrawal, poolDeposit);

              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Matches the pool withrawals with the pool deposits according to the 30 day rule and processes the results.
   * Returns when the first match is found or options are exhausted.
   * @return {boolean} Whether a match was found.
   */
  match30Days() {

    for (let poolWithdrawal of this.poolWithdrawals) {

      if (poolWithdrawal.action !== 'Transfer' && poolWithdrawal.action !== 'Fee' && poolWithdrawal.action !== 'Split') {

        for (let poolDeposit of this.poolDeposits) {

          if (poolDeposit.action !== 'Split' && poolDeposit.action !== 'Gift' && poolDeposit.action !== 'Income') {

            let diffDays = AssetTracker.diffDays(poolWithdrawal.date, poolDeposit.date);

            if (diffDays > 0 && diffDays <= 30) {

              this.matchFound(poolWithdrawal, poolDeposit);

              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Matches the pool withrawals with the merged pool deposit and processes the results.
   * Returns when the first match is found or options are exhausted.
   * @return {boolean} Whether a match was found.
   */
  matchPool() {

    for (let poolWithdrawal of this.poolWithdrawals) {

      this.mergePoolDeposits(poolWithdrawal.date);

      if (this.poolDeposits.length > 0 && !this.poolDeposits[0].date) {

        let poolDeposit = this.poolDeposits[0];

        if (poolWithdrawal.action === 'Transfer' || poolWithdrawal.action === 'Fee') {

          this.processTransferFee(poolWithdrawal, poolDeposit);
        }
        else if (poolWithdrawal.action === 'Split') {

          this.processSplit(poolWithdrawal, poolDeposit);
        }
        else {

          this.matchFound(poolWithdrawal, poolDeposit);
        }

        return true;
      }
      else {

        //the application should have thrown an asset account error before reaching here
        throw Error(`Insufficient funds: Attempted to withdraw ${this.asset} ${poolWithdrawal.debitAmount} + fee ${poolWithdrawal.debitFee} from balance of 0.`);

      }
    }
    return false;
  }

  /**
   * Adds the pool withdrawal debit fee to the pool deposit credit fee.
   * Used to add transfer and miscellaneous fees to the merged pool deposit.
   */
  processTransferFee(poolWithdrawal, poolDeposit) {

    poolDeposit.creditFeeSubunits += poolWithdrawal.debitFeeSubunits;
    if (poolDeposit.subunits === 0) {
      this.poolDeposits.splice(this.poolDeposits.indexOf(poolDeposit), 1);
      poolWithdrawal.debitFeeSubunits = 0;
      let closedPoolLot = new ClosedPoolLot(poolDeposit, poolWithdrawal);
      this.closedPoolLots.push(closedPoolLot);
    }
    this.poolWithdrawals.splice(this.poolWithdrawals.indexOf(poolWithdrawal), 1);
    return;
  }

  /**
   * Subtracts the pool withdrawal debit amount to the pool deposit credit amount.
   * Used to subtract the reverse split adjusment amount from the merged pool deposit.
   */
  processSplit(poolWithdrawal, poolDeposit) {

    poolDeposit.creditAmountSubunits -= poolWithdrawal.debitAmountSubunits;
    if (poolDeposit.subunits === 0) {
      this.poolDeposits.splice(this.poolDeposits.indexOf(poolDeposit), 1);
      poolWithdrawal.debitAmountSubunits = 0;
      let closedPoolLot = new ClosedPoolLot(poolDeposit, poolWithdrawal);
      this.closedPoolLots.push(closedPoolLot);
    }
    this.poolWithdrawals.splice(this.poolWithdrawals.indexOf(poolWithdrawal), 1);
    return;
  }

  /**
   * Processes a matched pool withdrawal and pool deposit by creating and adding a closed pool lot to the collection.
   */
  matchFound(poolWithdrawal, poolDeposit) {

    let closedPoolLot;

    if (poolWithdrawal.subunits === poolDeposit.subunits) {

      this.poolDeposits.splice(this.poolDeposits.indexOf(poolDeposit), 1);
      this.poolWithdrawals.splice(this.poolWithdrawals.indexOf(poolWithdrawal), 1);
      closedPoolLot = new ClosedPoolLot(poolDeposit, poolWithdrawal);

    }
    else if (poolWithdrawal.subunits > poolDeposit.subunits) {

      let poolWithdrawals = poolWithdrawal.split(poolDeposit.subunits);
      this.poolDeposits.splice(this.poolDeposits.indexOf(poolDeposit), 1);
      this.poolWithdrawals.splice(this.poolWithdrawals.indexOf(poolWithdrawal), 1, poolWithdrawals[1]);
      closedPoolLot = new ClosedPoolLot(poolDeposit, poolWithdrawals[0]);

    }
    else {

      let poolDeposits = poolDeposit.split(poolWithdrawal.subunits);
      this.poolDeposits.splice(this.poolDeposits.indexOf(poolDeposit), 1, poolDeposits[1]);
      this.poolWithdrawals.splice(this.poolWithdrawals.indexOf(poolWithdrawal), 1);
      closedPoolLot = new ClosedPoolLot(poolDeposits[0], poolWithdrawal);

    }
    this.closedPoolLots.push(closedPoolLot);
  }

  /**
   * Merges the pool deposits up to the given date and sets the date of the resulting merged pool deposit to null.
   * If no date is given merges all the pool deposits.
   * @param {Date} [date] - The date up to which to merge pool deposits.
   */
  mergePoolDeposits(date) {

    let mergedPoolDeposits = [];

    for (let poolDeposit of this.poolDeposits) {

      if (!date || poolDeposit.date <= date) {

        poolDeposit.date = null;

        if (mergedPoolDeposits.length > 0) {

          mergedPoolDeposits[0].merge(poolDeposit);
        }
        else {

          mergedPoolDeposits[0] = poolDeposit;
        }
      }
      else {

        mergedPoolDeposits.push(poolDeposit);
      }
    }
    this.poolDeposits = mergedPoolDeposits;
  }
};