/**
 * Pool transaction.
 * Represents a pool deposit or pool withdrawal in the asset pool.
 */
var PoolTransaction = class PoolTransaction {

  /**
   * Initializes the class with the properties set to the parameters.
   * @param {Date} date - The date of the transaction.
   * @param {Asset} debitAsset - The asset debited.
   * @param {number} debitAmount - The amount of asset debited.
   * @param {number} debitFee - The fee in debit asset units.
   * @param {Asset} creditAsset - The asset credited.
   * @param {number} creditAmount - The amount of asset credited.
   * @param {number} creditFee - The fee in credit asset units.
   * @param {string} action - The type of action of the pool transaction.
   */
  constructor(date, debitAsset, debitAmount, debitFee, creditAsset, creditAmount, creditFee, action) {

    /**
     * The date of the pool transaction.
     * @type {Date}
     */
    this.date = date;

    /**
     * The asset debited.
     * @type {Asset}
     */
    this.debitAsset = debitAsset;

    /**
     * The amount of asset debited in subunits.
     * @type {number}
     */
    this.debitAmountSubunits = AssetTracker.round(debitAmount * this.debitAsset.subunits);

    /**
     * The fee in debit asset subunits.
     * @type {number}
     */
    this.debitFeeSubunits = AssetTracker.round(debitFee * this.debitAsset.subunits);

    /**
     * The asset credited.
     * @type {Asset}
     */
    this.creditAsset = creditAsset;

    /**
     * The amount of asset credited in subunits.
     * @type {number}
     */
    this.creditAmountSubunits = AssetTracker.round(creditAmount * this.creditAsset.subunits);

    /**
    * The fee in credit asset subunits.
    * @type {number}
    */
    this.creditFeeSubunits = AssetTracker.round(creditFee * this.creditAsset.subunits);

    /**
     * The action in the ledger sheet that gave rise to the pool transaction.
     * @type {string}
     */
    this.action = action;
  }

  /**
   * The amount of asset debited.
   * @type {number}
   */
  get debitAmount() {

    return this.debitAmountSubunits / this.debitAsset.subunits;
  }

  /**
   * The fee in debit asset units.
   * @type {number}
   */
  get debitFee() {

    return this.debitFeeSubunits / this.debitAsset.subunits;
  }

  /**
   * The amount of asset credited.
   * @type {number}
   */
  get creditAmount() {

    return this.creditAmountSubunits / this.creditAsset.subunits;
  }

  /**
   * The fee in credit asset units.
   * @type {number}
   */
  get creditFee() {

    return this.creditFeeSubunits / this.creditAsset.subunits;
  }

  /**
   * Merges this pool transaction with another.
   * @param {PoolTransaction} poolTransaction - The pool transaction to merge with.
   */
  merge(poolTransaction) {

    if (this.date && this.date.getTime() !== poolTransaction.date.getTime()) {
      throw Error(`Unable to merge pool transaction with date ${this.date.toUTCString()} and pool transaction with date ${poolTransaction.date.toUTCString()}`);
    }
    else if (this.debitAsset !== poolTransaction.debitAsset) {
      throw Error(`Unable to merge pool transaction with debit asset ${this.debitAsset} and pool transaction with debit asset ${poolTransaction.debitAsset}`);
    }
    else if (this.creditAsset !== poolTransaction.creditAsset) {
      throw Error(`Unable to merge pool transaction with credit asset ${this.creditAsset} and pool transaction with credit asset ${poolTransaction.creditAsset}`);
    }
    this.debitAmountSubunits += poolTransaction.debitAmountSubunits;
    this.debitFeeSubunits += poolTransaction.debitFeeSubunits;
    this.creditAmountSubunits += poolTransaction.creditAmountSubunits;
    this.creditFeeSubunits += poolTransaction.creditFeeSubunits;

    if (poolTransaction.action !== this.action) {
      this.action = null;
    }
  }
};