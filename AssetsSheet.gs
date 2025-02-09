/**
 * Creates a sample assets sheet.
 * Renames any existing assets sheet so as not to overwrite it.
 */
AssetTracker.prototype.assetsSheet = function () {

  const sheetName = this.assetsSheetName;

  this.renameSheet(sheetName);

  let ss = SpreadsheetApp.getActive();
  sheet = ss.insertSheet(sheetName);

  this.trimSheet(sheet, 12, 7);

  let headers = [
    [
      'Asset',
      'Asset Type',
      'Decimal Places',
      'Current Price',
      'API',
      'Timestamp',
      'Comment'
    ]
  ];

  sheet.getRange('A1:G1').setValues(headers).setFontWeight('bold').setHorizontalAlignment("center");
  sheet.setFrozenRows(1);

  sheet.getRange('A2:A').setNumberFormat('@');
  sheet.getRange('C2:C').setNumberFormat('0');
  sheet.getRange('D2:D').setNumberFormat('#,##0.0000;(#,##0.0000)');
  sheet.getRange('E2:E').setNumberFormat('@');
  sheet.getRange('F2:F').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sheet.getRange('G2:G').setNumberFormat('@');

  let sampleFiatBase;
  let sampleFiat;
  let currencyConvert;
  let usdcPrice;
  if (this.accountingModel === 'UK') {
    sampleFiatBase = 'GBP';
    sampleFiat = 'USD';
    currencyConvert = '*D$3';
    usdcPrice = '=D$3';
  }
  else {
    sampleFiatBase = 'USD';
    sampleFiat = 'CAD';
    currencyConvert = '';
    usdcPrice = '1';
  }

  let sampleData = [
    [sampleFiatBase, 'Fiat Base', '2', '1', , , `Every asset in the ledger sheet must have an entry in the assets sheet.`],
    [sampleFiat, 'Fiat', '2', `=GOOGLEFINANCE(CONCAT(CONCAT("CURRENCY:", A3), "${sampleFiatBase}"))`, , , `Fiat capital gains are ignored.`],
    ['EUR', 'Forex', '2', `=GOOGLEFINANCE(CONCAT(CONCAT("CURRENCY:", A4), "${sampleFiatBase}"))`, , , `Forex is treated as any other asset.`],
    ['ADA', 'Crypto', '6', `=GOOGLEFINANCE(CONCAT(CONCAT("CURRENCY:", A5), "${sampleFiatBase}"))`, , , `Google finance is used to fetch the current price. Alternatively select an API or use your own method.`],
    ['BTC', 'Crypto', '8', `=GOOGLEFINANCE(CONCAT(CONCAT("CURRENCY:", A6), "${sampleFiatBase}"))`, , , ,],
    ['USDC', 'Stablecoin', '2', usdcPrice, , , ,],
    ['AAPL', 'Stock', '0', `=GOOGLEFINANCE(A8)${currencyConvert}`, , , ,],
    ['AMZN', 'Stock', '0', `=GOOGLEFINANCE(A9)${currencyConvert}`, , , ,],
    ['GE', 'Stock', '0', , , , `Current price is not needed for assets no longer held.`],
    ['NVDA', 'Stock', '0', `=GOOGLEFINANCE(A11)${currencyConvert}`, , , ,],
    [, , , , , , ,]
  ];

  sheet.getRange('A2:G').setValues(sampleData);

  let assetRule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied(`=REGEXMATCH(TO_TEXT(A2), "^(\\w{1,15}:)?[\\w$@]{1,10}$")`)
    .setAllowInvalid(false)
    .setHelpText(`Input must be 1-10 characters [A-Za-z0-9_$@] with optional prefix of 1-15 characters [A-Za-z0-9_] and colon [:].`)
    .build();
  sheet.getRange('A2:A').setDataValidation(assetRule);

  let assetTypeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Asset.defaultAssetTypes)
    .setAllowInvalid(true)
    .setHelpText(`New asset types will be added to the data validation dropdown when write reports is run.`)
    .build();
  sheet.getRange('B2:B').setDataValidation(assetTypeRule);

  let decimalPlacesRule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied(`=REGEXMATCH(TO_TEXT(C2), "^[012345678]{1}$")`)
    .setAllowInvalid(false)
    .setHelpText(`Input must be an integer between 0 and 8.`)
    .build();
  sheet.getRange('C2:C').setDataValidation(decimalPlacesRule);

  let apiRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(this.validApiNames)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('E2:E').setDataValidation(apiRule);

  if (!sheet.getFilter()) {
    sheet.getRange('A1:G').createFilter();
  }

  sheet.setColumnWidths(1, 5, 140);
  sheet.setColumnWidth(6, 170);

  SpreadsheetApp.flush();
  sheet.autoResizeColumns(7, 1);

  this.setSheetVersion(sheet, this.assetsSheetVersion);

  return sheet;
};

/**
 * Updates the sheet version to the current version if necessary.
 * Sets data validation on the asset type column of the assets sheet.
 * @param {Array<AssetRecord>} assetRecords - The collection of asset records previously read from the assets sheet.
 */
AssetTracker.prototype.updateAssetsSheet = function (assetRecords) {

  const sheetName = this.assetsSheetName;

  let ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return;
  }

  if (this.getSheetVersion(sheet) !== this.assetsSheetVersion) {

    //Future updates to the assets sheet can be inserted here

    this.setSheetVersion(sheet, this.assetsSheetVersion);
  }

  this.updateAssetsAssetTypes(sheet);
};

/**
 * Sets data validation on the asset type column of the assets sheet.
 * The list of asset types is collected when the ledger is processed to write the reports.
 * Both default and user defined asset types are sorted alphabetically.
 * The default asset types are listed before the user defined asset types.
 * @param {Sheet} sheet - The assets sheet.
 */
AssetTracker.prototype.updateAssetsAssetTypes = function (sheet) {

  let userDefinedAssetTypes = Array.from(this.userDefinedAssetTypes).sort(AssetTracker.abcComparator);
  let assetTypes = Asset.defaultAssetTypes.concat(userDefinedAssetTypes);

  let assetTypeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(assetTypes)
    .setAllowInvalid(true)
    .setHelpText(`New asset types will be added to the data validation dropdown when write reports is run.`)
    .build();
  sheet.getRange('B2:B').setDataValidation(assetTypeRule);
};

/**
 * Returns the range in the asset sheet that contains the data excluding header rows.
 * If there is no asset sheet it creates a sample asset sheet and returns the range from that.
 * Sets the assets named range to the data range.
 * Throws a ValidationError if the ledger sheet contains insufficient columns or no data rows.
 * @return {Range} The range in the asset sheet that contains the data excluding header rows.
 */
AssetTracker.prototype.getAssetsRange = function () {

  let ss = SpreadsheetApp.getActive();
  let assetsSheet = ss.getSheetByName(this.assetsSheetName);

  if (!assetsSheet) {

    assetsSheet = this.assetsSheet();
  }

  if (assetsSheet.getMaxColumns() < this.assetsDataColumns) {
    throw new ValidationError('Asset sheet has insufficient columns.');
  }

  let assetsRange = assetsSheet.getDataRange();

  ss.setNamedRange(this.assetsRangeName, assetsRange);

  if (assetsRange.getHeight() < this.assetsHeaderRows + 1) {
    throw new ValidationError('Asset sheet contains no data rows.');
  }

  assetsRange = assetsRange.offset(this.assetsHeaderRows, 0, assetsRange.getHeight() - this.assetsHeaderRows, this.assetsDataColumns);

  return assetsRange;
};