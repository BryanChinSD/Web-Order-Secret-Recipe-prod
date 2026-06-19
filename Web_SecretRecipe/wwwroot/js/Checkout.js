orgId = sessionStorage.getItem("Organization");
sessionStorage.removeItem("specialArea");
sessionStorage.removeItem("specialAreaInfo");
sessionStorage.removeItem("normalAreaInfo");
sessionStorage.removeItem("applicableDayCharges");
sessionStorage.removeItem("publicHolidayInfo");
sessionStorage.removeItem("isPublicHolidayAsSunday");
sessionStorage.removeItem("isToday");
sessionStorage.removeItem("liftCharges");
sessionStorage.removeItem("deliveryCharges");


const datepickerContainer = document.getElementById('appb9114bc45ab4c429_DateTime');
const deliveryTimeSelect = document.getElementById('appb9114bc45ab4c429_schedules'); // or the specific div wrapping time selection
let publicHolidayCache = [];
let blockedDates = [];
let dayChargesCache = null;
let price6R = 25;

if (!orgId) {
    getOrgId();
}

initBlockedDates();
initBlockedPickupDates();
function toggleDeliveryDateVisibility(show) {
    if (datepickerContainer) {
        datepickerContainer.style.display = show ? '' : 'none';
    }
    if (deliveryTimeSelect) {
        deliveryTimeSelect.style.display = show ? '' : 'none';
    }
}
const shippingZipInput = document.getElementById('shipping-zip');

if (shippingZipInput) {
    // On page load, hide/show based on initial input value
    toggleDeliveryDateVisibility(shippingZipInput.value.trim().length > 0);

    // On postal code input change, update visibility
    shippingZipInput.addEventListener('input', function (e) {
        const val = e.target.value.trim();
        toggleDeliveryDateVisibility(val.length > 0);
        handlePostalInput(e);
    });
}

function checkout() {
    GetPickUpOutlets();
    sessionStorage.setItem("freeDeliveryPromo", null);

    const cartDiscount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const itemImageSrcAddon = sessionStorage.getItem("coolerbagImgsrc");

    const summaryTable = document.querySelector("#collapseSummary .prod-list tbody");
    const subtotalElement = document.querySelector("#collapseSummary .total-line-subtotal_price");
    const totalElement = document.querySelector("#total-price");

    summaryTable.innerHTML = "";

    // ── Build cart summary rows + calculate items subtotal ────────────────────
    let subtotal = 0;

    cart.forEach(item => {
        const itemPrice = parseFloat(item.itemPrice) || 0;
        const icingCharges = parseFloat(item.IcingCharges) || 0;
        const quantity = parseInt(item.quantity) || 1;
        const itemTotal = (itemPrice + icingCharges) * quantity;
        subtotal += itemTotal;

        const itemImageSrc = item.packageName.toLowerCase().includes("cooler")
            ? itemImageSrcAddon
            : (item.imgSrc || "");

        summaryTable.insertAdjacentHTML("beforeend", `
            <tr>
                <td>
                    <div class="d-flex align-items-start">
                        <div class="prod-thumbnail flex-shrink-0">
                            <div class="prod-thumbnail-wrapper">
                                <img src="${itemImageSrc}" class="prod-thumbnail-img">
                            </div>
                            <div class="prod-thumbnail-qty">${quantity}</div>
                        </div>
                        <div class="prod-name">
                            <div>${item.packageName} (${item.packageType})</div>
                            ${icingCharges > 0 ? `<div class="prod-variant">Icing: SGD$ ${icingCharges.toFixed(2)}</div>` : ""}
                            ${item.cakeWriting ? `<div class="prod-variant">Writing: ${item.cakeWriting}</div>` : ""}
                        </div>
                    </div>
                </td>
                <td class="text-right vertical-align-top">
                    <div class="prod-price">SGD$ ${itemTotal.toFixed(2)}</div>
                </td>
            </tr>`);
    });

    // ── Delivery charge ───────────────────────────────────────────────────────
    const isPH = sessionStorage.getItem("publicHolidayInfo") !== null;
    let finalDeliveryCharge = 0;

    if (isPH) {
        finalDeliveryCharge = parseFloat(sessionStorage.getItem("applicableDayCharges")) || 0;
        console.log("PH Logic Applied: SGD$", finalDeliveryCharge);
    } else {
        const areaCharge = parseFloat(sessionStorage.getItem("deliveryCharges")) || 0;
        const liftCharge = parseFloat(sessionStorage.getItem("liftCharges")) || 0;
        finalDeliveryCharge = areaCharge + liftCharge;
        console.log("Normal Day Logic Applied: SGD$", finalDeliveryCharge);
    }

    const shippingElement = document.querySelector(".total-line-shipping_price");
    if (shippingElement) {
        shippingElement.textContent = `SGD$ ${finalDeliveryCharge.toFixed(2)}`;
    }

    // ── Apply discount if any ─────────────────────────────────────────────────
    // currentSub = discounted item subtotal (or full subtotal if no discount)
    let currentSub = subtotal;
    if (cartDiscount.length > 0) {
        currentSub = parseFloat(cartDiscount[0].disSubTotal) || subtotal;
    }

    // ── Tax on items + delivery combined (GST requirement) ────────────────────
    const tax = (currentSub + finalDeliveryCharge) * gst;

    // ── Grand total — this is exactly what #total-price shows ─────────────────
    const total = currentSub + finalDeliveryCharge + tax;

    // ── Update UI ─────────────────────────────────────────────────────────────
    subtotalElement.textContent = `SGD$ ${currentSub.toFixed(2)}`;
    document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
    totalElement.textContent = `SGD$ ${total.toFixed(2)}`;
    document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;

    // ── Session storage ───────────────────────────────────────────────────────
    sessionStorage.setItem("Tax", tax.toFixed(2));
    sessionStorage.setItem("SubTotal", currentSub.toFixed(2));    // items subtotal (for other UI)
    sessionStorage.setItem("TotalWithShipping", total.toFixed(2));

    //// ✅ FIX: store the grand total as the authoritative payment amount
    //// This is the SAME value shown in #total-price — sendPayLoad reads this
    //sessionStorage.setItem("cartItemsSubtotal", currentSub.toFixed(2));   // items only, for sortAndRender
    //sessionStorage.setItem("paymentAmount", total.toFixed(2));         // grand total → NETS
}


function processTimeSlots(slotsFromAPI) {
    const isPH = sessionStorage.getItem("publicHolidayInfo") !== null;
    const selectDropdown = document.getElementById('appb9114bc45ab4c429_schedules');

    // Filter logic
    const filtered = slotsFromAPI.filter(slot => {
        const isPHSlot = slot.eventTime.includes("(PH)");
        // If it's a holiday, only show (PH) slots. Otherwise, hide them.
        return isPH ? isPHSlot : !isPHSlot;
    });

    // Populate dropdown
    selectDropdown.innerHTML = '<option value="">Select Time</option>';
    filtered.forEach(slot => {
        const opt = document.createElement('option');
        opt.value = slot.id;
        opt.text = `${slot.eventTime} (SGD$ ${slot.eventTimeCharges})`;
        opt.dataset.charge = slot.eventTimeCharges;
        selectDropdown.appendChild(opt);
    });
}

//const shippingZipInput = document.getElementById('shipping-zip');
//if (shippingZipInput) {
//    toggleDeliveryDateVisibility(shippingZipInput.value.trim().length > 0);
//    shippingZipInput.addEventListener('input', handlePostalInput);
//}
//function checkout() {
//    GetPickUpOutlets();
//    sessionStorage.setItem("freeDeliveryPromo", null);
//    const cartDiscount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];
//    const cart = JSON.parse(localStorage.getItem("cart")) || [];
//    let cartDiscountSubTotal = 0;
//    let cartDisCode = '';
//    const has6R = cart.some(item => item.packageType === '6R');
//    const is6R = has6R ? 'Yes' : 'No';
//    sessionStorage.setItem('6R', is6R);

//    // Target elements inside #collapseSummary
//    const summaryTable = document.querySelector("#collapseSummary .prod-list tbody");
//    const subtotalElement = document.querySelector("#collapseSummary .total-line-subtotal_price");
//    const totalElement = document.querySelector("#total-price");
//    const discountInput = document.querySelector('#input-voucher_code');
//    const applyButton = document.querySelector(".apply-voucher");

//    // Clear previous cart summary
//    summaryTable.innerHTML = '';

//    let subtotal = 0;

//    // Loop through cart items and populate summary
//    cart.forEach(item => {
//        const itemTotal = (parseFloat(item.itemPrice) || 0) * (item.quantity || 1);
//        subtotal += itemTotal;
//        sessionStorage.setItem("currentSubtotal", parseFloat(subtotal).toFixed(2));
//        document.getElementById("subTotal").value = parseFloat(subtotal).toFixed(2);

//        const rowHTML = `
//            <tr>
//                <td>
//                    <div class="d-flex align-items-start">
//                        <div class="prod-thumbnail flex-shrink-0">
//                            <div class="prod-thumbnail-wrapper">
//                                <img src="${item.imgSrc}" class="prod-thumbnail-img">
//                            </div>
//                            <div class="prod-thumbnail-qty">${item.quantity}</div>
//                        </div>
//                        <div class="prod-name">
//                            <div>${item.packageName}</div>
//                            <div class="prod-variant">${item.packageType}</div>
//                        </div>
//                    </div>
//                </td>
//                <td class="text-right vertical-align-top">
//                    <div class="prod-price">SGD$ ${itemTotal.toFixed(2)}</div>
//                </td>
//            </tr>
//        `;

//        summaryTable.insertAdjacentHTML('beforeend', rowHTML);
//    });
//    // Calculate tax (assuming a fixed tax rate of 9%)
//    const tax = subtotal * gst;
//    const total = subtotal + tax;
//    sessionStorage.setItem("Tax", tax.toFixed(2));
//    // Update subtotal, tax, and total
//    subtotalElement.textContent = `SGD$ ${subtotal.toFixed(2)}`;
//    sessionStorage.setItem("currentSubtotal", parseFloat(total).toFixed(2));
//    sessionStorage.setItem("SubTotal", parseFloat(subtotal).toFixed(2));

//    document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//    totalElement.textContent = `SGD$ ${total.toFixed(2)}`;
//    document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;

//    if (cartDiscount && cartDiscount.length > 0) {
//        document.getElementById("applyVoucher").disabled = false;
//        document.querySelector("#applyVoucher").textContent = 'Remove'
//        cartDiscountSubTotal = parseFloat(cartDiscount[0].disSubTotal) || 0;
//        cartDiscountPercent = parseFloat(cartDiscount[0].discountPercentage) || 0;
//        discountAmount = (subtotal * cartDiscountPercent);
//        cartDisCode = cartDiscount[0].discountCode || '';
//        discountInput.value = cartDisCode;
//        discountInput.setAttribute("placeholder", '');
//        subtotalElement.textContent = `SGD$ ${(cartDiscountSubTotal).toFixed(2)}`;
//        document.querySelector(".total-line-tax_price").textContent = `SGD$ ${parseFloat(cartDiscountSubTotal * gst).toFixed(2)}`;
//        //console.log("Tax", parseFloat(cartDiscountSubTotal * gst));
//        sessionStorage.setItem("Tax", parseFloat(cartDiscountSubTotal * gst).toFixed(2));
//        sessionStorage.setItem("SubTotal", parseFloat(cartDiscountSubTotal).toFixed(2));

//        totalElement.textContent = `SGD$ ${(parseFloat(cartDiscountSubTotal * gst) + cartDiscountSubTotal).toFixed(2)}`;
//        cartDiscount[0].discountAmt = discountAmount;
//        localStorage.setItem("cartDiscountAmount", JSON.stringify(cartDiscount));

//    }
//    // Handle discount code
//    if (cartDiscountSubTotal > 0) {
//        discountInput.value = cartDisCode;
//        applyButton.textContent = "REMOVE";
//    } else {
//        discountInput.value = "";
//        applyButton.textContent = "Apply";
//    }
//    loadDeliveryTime();
//}

function processServiceList(jSonString, selectedService, netsMid, routeTo) {
    var msgRefId;
    var queryTimeoutTimer;
    // Set default value in milliseconds (e.g., 2000ms = 2 seconds)
    const intialApsQryCount = 3; // Number of first phase retries
    const finalApsQryCount = 5;   // Number of second phase retries
    const intApsQryDuration = 20000; // Interval duration in milliseconds
    // check if JQuery library is loaded
    if (typeof jQuery == 'undefined') {
        alert("[APPS.JS] jQuery NOT loaded ");
        var jq = document.createElement('script');
        jq.type = 'text/javascript';
        // Path to jquery.js file, eg. Google hosted version or local
        jq.src = gwdomain + '/GW2/js/jquery-3.6.3.min.js';
        document.getElementsByTagName('head')[0].appendChild(jq);
    }

    // AJAX properties for application
    var contentTypeVal = "application/json";

    var objStr = typeof jSonString === "string" ? JSON.parse(jSonString) : jSonString;
    var tsIntMsg = "";
    var tsMerchMsg = "";
    var tsStatus = "";

    console.log(objStr);
    txnRand = objStr.txnRand;
    netsTxnRef = objStr.netsTxnRef;
    netsMidGlobal = netsMid;
    merchantTxnRef = objStr.merchantTxnRef;
    b2sTxnEndURL = objStr.b2sTxnEndURL;
    // Store reference in localStorage for tracking
    localStorage.setItem("merchantTxnRef", merchantTxnRef);

    // Retry counters
    const maxRetries = 20;
    const retryInterval = 15000; // 15 seconds
    let retryCount = 0;
    let retryTimeoutId = null;
    let netsAmountDeducted = parseInt(objStr.txnAmount);

    function doFallbackQuery() {
        if (!merchantTxnRef) return;

        const resolvedKey = `txn-${merchantTxnRef}-resolved`;
        if (sessionStorage.getItem(resolvedKey) === "true") {
            console.log("Already resolved. Redirecting...");
            return;
        }

        console.warn(`Fallback Query: Attempt #${retryCount + 1}`);

        fetch(`/SR/CheckTxnStatus?merchantTxnRef=${merchantTxnRef}`)
            .then(res => res.json())
            .then(j => {
                console.log("status", j.status);
                if (j.status === "success") {
                    sessionStorage.setItem(resolvedKey, "true");
                    const data = j.msg;

                    const fullPayload = {
                        ss: "1",
                        msg: {
                            netsMid: objStr.netsMid,
                            merchantTxnRef: merchantTxnRef,
                            netsTxnStatus: data.netsTxnStatus,
                            netsTxnMsg: data.netsTxnMsg,
                            netsTxnRef: netsTxnRef,
                            netsTxnDtm: data.netsTxnDtm,
                            netsAmountDeducted: netsAmountDeducted,
                            paymentMode: data.paymentMode,
                            bankRefCode: data.bankRefCode,
                            netsMidIndicator: netsMidIndicator
                        }
                    };

                    sessionStorage.setItem("Payload", JSON.stringify(fullPayload));

                    const form = document.createElement("form");
                    form.method = "POST";
                    form.action = "/SR/Return";

                    const input = document.createElement("input");
                    input.type = "hidden";
                    input.name = "message";
                    input.value = JSON.stringify(fullPayload);

                    form.appendChild(input);
                    document.body.appendChild(form);
                    form.submit();
                } else if (j.status === "failure") {
                    sessionStorage.setItem(resolvedKey, "true");
                    window.location.href = `/SecretRecipe/Checkout`;
                } else if (j.status === "pending" || j.status === "not_found") {
                    retryCount++;
                    scheduleNextRetry(); // ✅ only schedule 1 retry at a time
                }
            })
            .catch(err => {
                console.error("Error querying transaction status", err);
            });
    }

    // ⏱️ Initial delay before starting fallback logic
    setTimeout(doFallbackQuery, 10000); // 10 seconds

    function scheduleNextRetry() {
        if (retryCount < maxRetries) {
            clearTimeout(retryTimeoutId);
            retryTimeoutId = setTimeout(doFallbackQuery, retryInterval);
        } else {
            alert("Unable to confirm payment. Please try again later.");
        }
    }

    if ('tsStatus' in objStr) {
        tsStatus = objStr.tsStatus;
    }

    if ('tsIntMsg' in objStr) {
        tsIntMsg = objStr.tsIntMsg;
    }

    if ('tsMerchMsg' in objStr) {
        tsMerchMsg = objStr.tsMerchMsg;
    }

    //creditcard
    gexp = objStr.rsaExponent;
    gmod = objStr.rsaModulus;

    console.log(gexp);
    if (typeof isHostedPage !== undefined && isHostedPage == true) {
        if ($("#netsTxnRef").length) {
            $("#netsTxnRef").text(netsTxnRef);
        }
    }

    var tsReqFlag = null;
    var selectedTokenServ = selectTokenServiceForTxn(objStr.paymtSvcInfoList);

    if (selectedTokenServ != null && selectedTokenServ != "NOCVV" && selectedTokenServ != "TSERROR") {
        tsReqFlag = 1;
    }
    else if (selectedTokenServ != null && selectedTokenServ == "NOCVV" && selectedTokenServ != "TSERROR") {
        tsReqFlag = 4;
    }
    else if (selectedTokenServ != null && selectedTokenServ == "TSERROR") {
        tsReqFlag = 3;
    }

    var noOfServ = objStr.merchantSvcList.length;
    console.log("objStr is:" + objStr);
    console.log(" no of services " + objStr.merchantSvcList.length);
    console.log("tsReqFlag is: " + tsReqFlag + "For: " + selectedTokenServ);
    var onlyCCService = true;
    //var onlyCCService = false;
    var ccSNo = 0;
    // take into consideration if service list is only APS (though service list
    // is more than 1 due to subservices),
    // number of services should always be 1
    if (objStr.onlyAPSFlag == 'T') {
        noOfServ = 1;
    }
    else {
        onlyCCService = true;
        for (i = 0; i < objStr.merchantSvcList.length; i++) {
            if (objStr.merchantSvcList[i].indexOf("CC_") == -1) {
                onlyCCService = false;
            }
        }
        console.log("onlyCCService : " + onlyCCService);
        console.log("objStr.currencyCode" + objStr.currencyCode);
        for (i = 0; i < objStr.merchantSvcList.length; i++) {
            if ((objStr.merchantSvcList[i].indexOf("CC_") != -1) && (objStr.merchantSvcList[i].indexOf("AMEX") == -1)) {
                // UMID will not contain multiple currency credit 
                //ccSNo = 1;
                ccSNo = ccSNo + 1;
                console.log("ccSNO : " + ccSNo);
            }
            if (objStr.merchantSvcList[i].indexOf("AMEX") != -1) {
                //contains amex
                ccSNo = ccSNo + 2;
                console.log("ccSNO : " + ccSNo);
            }
        }
        if (onlyCCService) {
            noOfServ = 1;
        }
    }


    if (!jQuery.isEmptyObject(objStr.walletSvcList)) {
        noOfServ = 2;
    }

    // alert("[APPS.JS] noOfServ is= " + noOfServ);

    // testing codes - to test out 1 service only
    // noOfServ = 1;
    // serviceName = 'APS_SGD_NETS2.0';
    // routeTo = 'FEH';

    // noOfServ = 1 if bypassing the OnePagePage
    // selectedsERVICE != '' if invoked from onePage and selected a service
    if (noOfServ == 1 || selectedService != null) {
        var serviceName;

        // if byPass OnePager, get from merchantSvcList
        if (noOfServ == 1) {
            serviceName = objStr.merchantSvcList[0];
            routeTo = objStr.routeTo;
            //netsMid = objStr.paymtSvcInfoList[0].netsMid;
            if (onlyCCService && objStr.onlyAPSFlag != 'T') {
                serviceName = "CC_" + ccSNo;
            }
        } else { // if from OnePager
            serviceName = selectedService;
        }

        // alert("[APPS.JS] service name is: " + serviceName);

        if (serviceName == 'UPOP_SGD') {

            if (routeTo == 'FEH') {

                alert("[APPS.JS] this is UPOP");
                // making REST call now
                // create the JSON request to send 2nd request (via Consumer
                // browser) to FE
                var payRequest2 = '{"txnRand":"'
                    + objStr.txnRand
                    + '","submissionMode":"B","paymentMode":"UPOP","netsTxnRef":"'
                    + objStr.netsTxnRef + '","netsMid":"' + netsMid + '"}';

                $.ajax({
                    type: "POST",
                    url: gwdomain + "/GW2/processUpopFrontEnd",
                    contentType: contentTypeVal,
                    cache: false,
                    dataType: "html",
                    data: payRequest2,

                    success: function (data, textStatus, jqXHR) {
                        $("#ajaxResponse").html("");
                        $("#ajaxResponse").append(data);
                        alert("Successful");
                        alert("Data to send to UPOP is: " + data);
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        alert("Error Encountered");
                        $("#ajaxResponse").html("");
                        $("#ajaxResponse").append("ERROR ENCOUNTERED");
                    }
                });
            } // reserve for other routing operations (e.g. DISTRA)
        } else if ('CC' == serviceName.slice(0, 2)) {
            // alert("This is CC");
            console.log("selected service=" + selectedService);
            if (selectedService == 'CC_MP') {
                console.log("Incoming MasterPass transaction");

                $(function () { // when DOM is ready
                    // alert("DOM is ready ");
                    // $("#ajaxResponse").load(
                    // "https://sit2.enets.sg/GW2/credit/init"); // load the
                    // sample.jsp page in the #chkcomments element

                    $.post(gwdomain + "/GW2/creditFEH/redirectMasterPass", {
                        txnRand: objStr.txnRand, netsMid: objStr.netsMid, routeTo: routeTo
                    }, function (data, status) {
                        // alert("Data: " + data + "\nStatus: " + status);
                        console.log("Data received : " + status)
                        console.log(data);
                        //	$("#anotherSection").empty().append(data);
                        $("#ajaxResponse").empty().append(data);
                    });
                });

            } else {
                console.log("in credit mode", objStr);
                var expYear = "";
                var expMonth = "";
                if (objStr.expiryDate != null) {
                    expYear = objStr.expiryDate.substring(0, 2);
                    expMonth = objStr.expiryDate.substring(2, 4);
                }

                var paymentModeSelected = "CC";
                if (serviceName.indexOf("AMEX") != -1) {
                    paymentModeSelected = "CA";
                }
                $(function () { // when DOM is ready
                    // alert("DOM is ready ");
                    // $("#ajaxResponse").load(
                    // "https://sit2.enets.sg/GW2/credit/init"); // load the
                    // sample.jsp page in the #chkcomments element

                    $.post("/SR/PostCreditInit", {
                        txnRand: objStr.txnRand,
                        paymentMode: serviceName,
                        routeTo: routeTo,
                        selectedTokenService: selectedTokenServ,
                        tsTxnReqFlag: tsReqFlag,
                        cardHolderName: objStr.cardHolderName,
                        consumerEmail: objStr.consumerEmail,
                        maskPan: objStr.maskPan,
                        expiryMonth: expMonth,
                        expiryYear: expYear,
                        tsProcessingCode: objStr.tsProcessingCode,
                        tsStatus: tsStatus,
                        tsIntMsg: tsIntMsg,
                        tsMerchMsg: tsMerchMsg,
                    }, function (data, status) {
                        // alert("Data: " + data + "\nStatus: " + status);
                        console.log("Data received : " + status)
                        console.log(data);
                        //	$("#anotherSection").empty().append(data);
                        $("#ajaxResponse").empty().append(data);
                    });
                });
            }
        } else if (serviceName == 'DD') {
            // do something here
            //222
            // Assume gwdomain and objStr are already defined
            let payload = {
                txnRand: objStr.txnRand,
                paymentMode: "DD"
            };

            $.ajax({
                type: "POST",
                url: "/SR/PostDebitInit",
                contentType: "application/x-www-form-urlencoded",
                dataType: "html",
                data: payload, // your key1=value1&key2=value2 string
                success: function (data) {
                    const parser = new DOMParser();
                    const parsedDoc = parser.parseFromString(data, 'text/html');

                    // Inject only the body content
                    const bodyContent = parsedDoc.body.innerHTML;
                    $('#ajaxResponse').html(bodyContent);

                    // Re-execute scripts safely
                    const scripts = parsedDoc.querySelectorAll("script");
                    scripts.forEach((script) => {
                        const newScript = document.createElement("script");

                        if (script.src) {
                            // External JS
                            newScript.src = script.src;
                        } else {
                            // Inline JS
                            newScript.textContent = script.textContent;
                        }

                        document.body.appendChild(newScript);
                    });
                    console.log("Injected content and scripts executed.");
                },
                error: function () {
                    console.error("Error loading eNETS response");
                    writeErrorInfo("0010-50003", "1");
                }
            });



            //Note: The startsWith() method is not supported in IE 11 (and earlier versions).
        } else if (serviceName.indexOf('APS_SGD') == 0) {

            const apsRequest = JSON.stringify({
                ss: "1",
                msg: {
                    txnRand: txnRand,
                    netsTxnRef: netsTxnRef,
                    netsMid: objStr.netsMid,
                    netsMidIndicator: netsMidIndicator,
                    paymentMode: "QR"
                }
            });

            if (routeTo === 'FEH') {
                $.ajax({
                    type: "POST",
                    url: "/SR/PostPaymentQR",
                    contentType: contentTypeVal,
                    dataType: "json",
                    data: apsRequest,
                    success: function (data) {
                        const objStr = jQuery.parseJSON(JSON.stringify(data));
                        const objMsg = jQuery.parseJSON(JSON.stringify(objStr.msg));

                        /* ---- Fail fast on missing QR data ---- */
                        if (jQuery.isEmptyObject(objMsg.qrData)) {
                            if (!jQuery.isEmptyObject(objMsg.hmac) &&
                                !jQuery.isEmptyObject(objMsg.rawMsg)) {
                                processErrorPage(JSON.stringify(objMsg), null, null, null);
                            } else {
                                writeErrorInfo(objMsg.stageRespCode || "0010-50003",
                                    objMsg.actionCode || "1");
                            }
                            return;
                        }

                        /* ---- Render QR page ---- */
                        $.ajax({
                            type: "POST",
                            url: "/SR/DisplayQRpage/?serviceName=" + serviceName,
                            contentType: contentTypeVal,
                            cache: false,
                            dataType: "html",
                            data: objMsg.qrData,
                            success: function (html) {

                                $("#ajaxResponse").html(html);
                                $(".col-xs-12.col-sm-7.col-md-8.col-lg-8").hide();

                                /* -----------------------------------------
                                 * POLLING PARAMETERS
                                 * ----------------------------------------- */
                                const POLL_INTERVAL = 6000;        // 6 s
                                const MAX_WAIT_TIME = 5 * 60_000;  // 5 min

                                let apsPollTimer = null;
                                let maxWaitTimeout = null;
                                let msgRefId = null;

                                const pollPayload = JSON.stringify({
                                    ss: "1",
                                    msg: {
                                        txnRand: txnRand,
                                        netsTxnRef: netsTxnRef,
                                        b2sTxnEndURL: b2sTxnEndURL,
                                        paymentMode: "QR",
                                        merchantTxnRef: merchantTxnRef
                                    }
                                });

                                /* -------- Helper to stop all timers ------ */
                                function stopApsPolling() {
                                    clearInterval(apsPollTimer);
                                    clearTimeout(maxWaitTimeout);
                                }

                                /* -------- First call to get msgRefId ------ */
                                function initApsQuery() {
                                    $.ajax({
                                        type: "POST",
                                        url: "/SR/doApsQuery",
                                        contentType: contentTypeVal,
                                        dataType: "html",
                                        data: pollPayload,
                                        success: function (html) {
                                            msgRefId = $(html).find("#msgRefId").val();
                                            netsMidGlobal = $(html).find("#netsMid").val();
                                            startApsPolling();      // begin 6 s polling loop
                                        },
                                        error: () => writeErrorInfo("0030-50002", "1")
                                    });
                                }

                                /* ------------- 6 ‑second polling ---------- */
                                function ApsQueryStat() {
                                    $.ajax({
                                        type: "POST",
                                        url: "/SR/DoInternalApsQuery",
                                        contentType: contentTypeVal,
                                        dataType: "html",
                                        data: pollPayload,
                                        headers: { "msgRefId": msgRefId },
                                        success: function (html) {
                                            const respCode = $(html).find("#apsStageRespCode").val();
                                            const action = $(html).find("#apsActionCode").val();

                                            if (respCode === '3000-00000') {          // ✅ success
                                                stopApsPolling();
                                                $("#ajaxResponse").html(html);
                                            } else if (respCode === '0050-50002' ||
                                                respCode === '0050-50003') {    // ❌ error
                                                stopApsPolling();
                                                writeErrorInfo(respCode, action);
                                            }
                                            /* else keep polling until timeout */
                                        },
                                        error: (x) => {
                                            if (x.status !== 504) console.error("APS query error", x);
                                        }
                                    });
                                }

                                /* ------------- Start polling + timeout ---- */
                                function startApsPolling() {
                                    apsPollTimer = setInterval(ApsQueryStat, POLL_INTERVAL);

                                    maxWaitTimeout = setTimeout(() => {
                                        stopApsPolling();
                                        $("#ajaxResponse")
                                            .html("<div style='color:red;'>QR expired. Please refresh to try again.</div>");
                                    }, MAX_WAIT_TIME);
                                }

                                /* Kick‑off */
                                initApsQuery();
                            },
                            error: () => writeErrorInfo("0030-50002", "1")
                        });
                    },
                    error: () => writeErrorInfo("0030-50002", "1")
                });
            }
        }
        else if (serviceName.slice(0, 3) == "IPP") {
            $(function () {
                $.post(gwdomain + "/GW2/credit/init", {
                    txnRand: objStr.txnRand,
                    paymentMode: serviceName,
                    routeTo: routeTo,
                }, function (data, status) {
                    // alert("Data: " + data + "\nStatus: " + status);
                    console.log("Data received : " + status)
                    console.log(data);
                    //	$("#anotherSection").empty().append(data);
                    $("#ajaxResponse").empty().append(data);
                });
            });
        }


    } else {
        $.ajax({
            type: "POST",
            url: "/SR/PrepareOnePager",
            contentType: "application/json",
            cache: false,
            dataType: "html", // expecting full HTML
            data: jSonString,
            success: function (data) {
                // Use DOMParser instead of jQuery to safely parse full HTML
                const parser = new DOMParser();
                const parsedDoc = parser.parseFromString(data, 'text/html');

                // Extract just the body content
                const bodyContent = parsedDoc.body.innerHTML;

                // Optional: remove script tags if needed
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = bodyContent;

                // Remove specific external scripts if needed
                const scripts = tempDiv.querySelectorAll('script[src*="apps.js"]');
                scripts.forEach(s => s.remove());

                // Inject into your target div
                document.getElementById('ajaxResponse').innerHTML = tempDiv.innerHTML;
            },
            error: function () {
                writeErrorInfo("0010-50002", "1");
            }
        });


    }
}


function selectTokenServiceForTxn(seriveList) {
    var count = 0;
    var service = null;
    var serviceDict = {};
    if (seriveList.length != null) {
        for (var i = 0; i < seriveList.length; i++) {
            if ('tsReqFlag' in seriveList[i]) // tsReqFlag
            {
                if (seriveList[i]['tsReqFlag'] == "1") { // check which
                    // service activated
                    // for ccof
                    service = seriveList[i]['paymtSvcId'];
                    count++;
                }

                if (seriveList[i]['tsReqFlag'] == "4") { // cvv not required
                    service = "NOCVV";
                }

                if (seriveList[i]['tsReqFlag'] == "3") { // token error
                    service = "TSERROR";
                }
            }
        }
    }

    if (count > 1) {
        return "ALL";
    }
    return service;
}

function uploadImage(fileInput) {
    const file = fileInput.files[0];
    if (!file) {
        alert("Please select a file.");
        return;
    }

    if (!file.type.startsWith('image/')) {
        alert("Please upload a valid image file.");
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        alert("Image size should not exceed 5MB.");
        return;
    }

    console.log("Selected file name:", file.name); // 🔍 Check file name

    const reader = new FileReader();
    reader.onload = function (e) {
        const base64Image = e.target.result;

        const payload = {
            entityName: "ADImage",
            organization: orgId,
            name: file.name,
            bindaryData: base64Image
        };

        console.log("Payload:", payload); // 🔍 Confirm payload

        $.ajax({
            url: '/SR/PostCakeWritingImage',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(payload),
            success: function (response) {
                console.log("✅ Upload successful:", response);

                let parsedMessage;
                try {
                    parsedMessage = JSON.parse(response.message);
                } catch (e) {
                    console.error("❌ Failed to parse `message`:", e);
                    alert("Unexpected server response format.");
                    return;
                }

                const imageId = parsedMessage?.response?.data?.[0]?.id;

                if (imageId) {
                    console.log("📸 imageId:", imageId);
                    sessionStorage.setItem("IcingImage", imageId);
                    alert("Image uploaded successfully.");
                } else {
                    console.warn("❗ No image ID found in parsed message.");
                    alert("Upload completed, but no image ID was returned.");
                }
            },
            error: function (xhr) {
                console.error(`❌ Upload failed [${xhr.status}]:`, xhr.responseText || "No response text");
                alert("Upload failed: " + (xhr.responseText || "Unknown error occurred."));
            }
        });
    };
    reader.onerror = function () {
        alert("Failed to read file.");
    };
    reader.readAsDataURL(file);
}

function writeErrorInfo(stageResponseCode, actionCode) {

    $("#ajaxResponse").html("");
    $("#ajaxResponse").append("<b>Please quote ERROR CODE=" + stageResponseCode + " and ACTION CODE="
        + actionCode + " with the below merchant information:</b><br>");

    //$("#ajaxResponse").append("<b>Merchant ID=" + merchantInfo.netsMid + "</b><br>");
    //$("#ajaxResponse").append("<b>Transaction Date Time =" + merchantInfo.merchantTxnDtm + "</b><br>");
    //$("#ajaxResponse").append("<b>Merchant Reference=" + merchantInfo.merchantTxnRef + "</b>");


}


function doTimeOutForApsQuery() {
    if (typeof queryTimeoutTimer !== 'undefined') {
        clearTimeout(queryTimeoutTimer);
    }
    var mviApsQueryTimeout = 30; // or retrieve from config/api/DOM

    console.log("Creating apsQueryTimeout...");
    queryTimeoutTimer = setTimeout(() => {
        writeErrorInfo('0050-50003', '2');
    }, Number(mviApsQueryTimeout) * 1000);
}



function setFormReadOnly(containerId, isDisabled = true) {
    const container = document.getElementById(containerId);
    if (!container) return;
    console.log("checkoutForm");
    const formElements = container.querySelectorAll('input, textarea, select, button');
    formElements.forEach(el => {
        if (el.tagName === "INPUT") {
            const type = el.type.toLowerCase();

            if (type === "text" || type === "number" || type === "email" || type === "date") {
                el.readOnly = isDisabled;
            } else if (type === "radio" || type === "checkbox") {
                el.disabled = isDisabled;  // ✅ properly disable radio/checkbox
            } else {
                el.disabled = isDisabled;  // fallback for other input types
            }

        } else if (el.tagName === "TEXTAREA") {
            el.readOnly = isDisabled;

        } else if (el.tagName === "SELECT" || el.tagName === "BUTTON") {
            el.disabled = isDisabled;
        }
    });
}
function updateXmlWithPayment(xmlString) {
    const parser = new DOMParser();
    const serializer = new XMLSerializer();

    const xmlDoc = parser.parseFromString(xmlString, "application/xml");

    // Retrieve payment info from sessionStorage
    const paymentStatus = sessionStorage.getItem("paymentStatus") || "N";
    const paymentMethod = sessionStorage.getItem("paymentMethod") || "N/A";
    const netReference = sessionStorage.getItem("netReference") || "N/A";
    const transactionReference = sessionStorage.getItem("transactionReference") || "N/A";

    // Update <master> node fields
    const masterNode = xmlDoc.getElementsByTagName("master")[0];
    if (masterNode) {
        masterNode.getElementsByTagName("payment_success")[0].textContent = paymentStatus;
        masterNode.getElementsByTagName("payment_mode")[0].textContent = paymentMethod;
        masterNode.getElementsByTagName("payment_refenceno")[0].textContent = netReference;
        masterNode.getElementsByTagName("payment_method")[0].textContent = transactionReference;
    }

    // Convert back to XML string
    return serializer.serializeToString(xmlDoc);
}


async function SendPostCartItem() {
    sessionStorage.removeItem("xmlData"); 
    if (!XMLBody) {
        console.warn("No XML data found in sessionStorage.");
        return;
    }

    // Update XML with payment info and use the updated version
    const updatedXML = updateXmlWithPayment(XMLBody);


    $.ajax({
        url: `/SR/SendCartItem`,
        type: 'POST',
        data: updatedXML,
        contentType: 'application/xml',
        processData: false,

        success: function (response) {
            console.log('response:', response.message);

            if (response.status === "success") {
                try {
                    const nestedJson = JSON.parse(response.message);
                    const docNo = nestedJson.DocNo?.trim();

                    if (docNo) {
                        $('#docNoDisplay').text(docNo);
                        sessionStorage.setItem("docNo", docNo);
                        const docSpan = document.getElementById("docNoDisplay");
                        docSpan.textContent = docNo;

                        const docLi = docSpan?.parentElement;
                        if (docLi) docLi.style.display = "flex";
                        localStorage.clear();
                        sessionStorage.clear();
                    } else {
                        hideOrderNumberRow();
                    }

                } catch (e) {
                    console.error("Failed to parse nested JSON:", e);
                    alert("Failed to parse nested JSON:", e);

                }
            } else {
                console.error('Error status:', response.message);
                alert("Error status:", response.message);

            }
        },

        error: function (jqXHR, textStatus, errorThrown) {
            console.error('AJAX Error:', textStatus, errorThrown);
            alert("AJAX Error:", errorThrown);

        }
    });
}


function hideOrderNumberRow() {
    const docSpan = document.getElementById("docNoDisplay");
    const docLi = docSpan?.parentElement;
    if (docLi) docLi.style.display = "none";
}

//function formatDate(dateStr) {
//    if (!dateStr) return null;

//    // Expecting "DD/MM/YYYY"
//    var parts = dateStr.split('/');
//    if (parts.length !== 3) return null;

//    var day = parts[0];
//    var month = parts[1];
//    var year = parts[2];

//    // Basic validation
//    return `${year}-${month}-${day}`;
//} 
function formatDate(dateStr) {
    if (!dateStr) return null;

    // Split the input by "/"
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-based
    const year = parseInt(parts[2], 10);

    const d = new Date(year, month, day);
    if (isNaN(d.getTime())) return null;

    // Format as YYYY-MM-DD
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    const yyyy = d.getFullYear();

    return `${yyyy}-${mm}-${dd}`;
}




async function loadDeliveryTime() {
    const cacheKey = "eventTimes";
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
        return JSON.parse(cachedData);
    }

    return new Promise((resolve, reject) => {
        $.ajax({
            type: "GET",
            dataType: "json",
            url: "/SR/EventTime",
            success: function (data) {
                const items = data.data ? JSON.parse(data.data) : {};
                const eventTimes = items.response?.data || [];
                eventTimes.sort((a, b) => a.sortSeq - b.sortSeq);

                sessionStorage.setItem(cacheKey, JSON.stringify(eventTimes));
                resolve(eventTimes);
            },
            error: function (xhr, status, error) {
                console.error("❌ Failed to load delivery time data.", error);
                reject(error);
            }
        });
    });
}

function formatTimeTo12h(time24) {
    if (typeof time24 !== 'string' || !time24) {
        return '';  // or some default string like "Invalid time"
    }
    const [hour, minute] = time24.split(':').map(Number);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

function renderEventOptions(filteredEventObjects) {
    const dropdown = document.getElementById('dmeta2');
    if (!dropdown) return;
    //console.log("filteredEventObjects", filteredEventObjects);
    dropdown.innerHTML = '';

    const eventTimesRaw = sessionStorage.getItem("eventTimes");
    if (!eventTimesRaw) {
        console.warn("⚠️ No eventTimes in storage yet, retrying in 100ms...");
        setTimeout(() => renderEventOptions(filteredEventObjects), 100);
        return;
    }

    const eventTimes = JSON.parse(eventTimesRaw);
    const eventMap = new Map(eventTimes.map(evt => [evt.eventTime, evt]));

    for (const evtObj of filteredEventObjects) {
        const event = eventMap.get(evtObj.eventTime);
        if (!event) {
            console.warn('Event not found in storage for:', evtObj.eventTime);
            continue;
        }

        let deliveryCost = evtObj.deliveryCost || 0;
        const is6R = sessionStorage.getItem("6R") === "Yes";
        if (is6R || deliveryCost > price6R) deliveryCost = price6R;

        const optionValue = JSON.stringify({
            title: event.eventTime,
            item_descr: event.description || "null",
            ltitle: "Event Time",
            price: event.price || 0,
            cost: deliveryCost,
            item_no: event.item_no || '',
            item_id: event.id,
        });

        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = `${event.eventTime} - $${deliveryCost.toFixed(2)}`;
        dropdown.appendChild(option);
    }
}

function updateUIForDeliveryMethod(isPickup, pickupName, pickupAddressText) {
    const alertInfo = document.querySelector('.alert.alert-info.mt-3');
    const pickupSection = document.getElementById('pickup-section');
    const pickup_address = document.getElementById('pickup_address');
    const location_details = document.getElementById('location_details_wrapper');
    const deliveryMethod = document.getElementById('delivery_method');
    const pickup_datepicker = document.getElementById('pickup_datepicker');
    const receiver_section = document.getElementById('receiver_section');
    const shipping_warpper = document.getElementById('shipping-address-section');
    const shipping_methods = document.getElementById('shipping_methods');
    const billing_radio = document.getElementById('billing-address-radio');
    const billing_form = document.getElementById('billing-address-form-wrapper');
    const shippingDesc = document.getElementById('shippingDesc');
    const shippingPrice = document.getElementById('shippingPrice');
    const pickupTitle = document.getElementById("pickup_title");
    const pickupAddress = document.getElementById("pickAddress");

    alertInfo.classList.add('skeleton-loading');

    // Calculate subtotal from cart (items only)
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const cartDiscount = JSON.parse(localStorage.getItem("cartDiscountAmount") || "[]");
    let subtotal = 0;

    cart.forEach(item => {
        subtotal += parseFloat(item.total) || 0;
    });

    sessionStorage.setItem("SubTotal", parseFloat(subtotal).toFixed(2));
    console.log("SubTotal", subtotal);

    // Base tax/total on items only — delivery will be added separately for shipping
    let tax = subtotal * gst;
    let total = subtotal + tax;

    if (cartDiscount.length > 0) {
        tax = parseFloat(cartDiscount[0].disSubTotal) * gst;
        total = parseFloat(cartDiscount[0].disSubTotal) + tax;
    }

    console.log("Updating UI for", isPickup ? "pickup" : "shipping");

    // Toggle visibility
    pickupSection.style.display = isPickup ? 'block' : 'none';
    pickup_address.style.display = isPickup ? 'block' : 'none';
    location_details.style.display = isPickup ? 'block' : 'none';
    deliveryMethod.style.display = isPickup ? 'block' : 'none';
    pickup_datepicker.style.display = isPickup ? 'block' : 'none';
    receiver_section.style.display = isPickup ? 'block' : 'none';
    shipping_warpper.style.display = isPickup ? 'none' : 'block';
    shipping_methods.style.display = isPickup ? 'none' : 'block';
    billing_radio.style.display = isPickup ? 'none' : 'block';
    billing_form.style.display = isPickup ? 'block' : 'none';

    pickupTitle.innerText = pickupName || "Select a Pickup Location";
    pickupAddress.innerText = pickupAddressText || "No address provided";
    alertInfo.classList.remove('skeleton-loading');

    if (isPickup) {
        console.log("isPickup");
        document.getElementById("dmeta3").innerHTML = "";
        document.getElementById("appb9114bc45ab4c429_DateTime").style.display = "none";

        // ✅ FIX: Zero out ALL delivery keys so no stale charges survive
        sessionStorage.setItem("Shipping", "0");
        sessionStorage.setItem("deliveryCharges", "0");
        sessionStorage.setItem("liftCharges", "0");
        sessionStorage.removeItem("specialAreaInfo");
        sessionStorage.removeItem("normalAreaInfo");
        sessionStorage.removeItem("specificDayInfo");
        sessionStorage.removeItem("publicHolidayInfo");

        shippingDesc.style.display = "block";
        shippingPrice.style.display = "none";

        // ✅ FIX: Total uses items-only tax/total (delivery = $0 for pickup)
        document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
        document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
        document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;

        loadCollectionTime();

    } else {
        console.log("Non-Pickup");
        document.getElementById("dmeta3").innerHTML = "";
        document.getElementById("shipping-methods-placeholder").style.display = "block";
        document.getElementById("shipping-methods-content").style.display = "none";
        document.getElementById("shipping-price-info").style.display = "none";
        shippingDesc.style.display = "block";
        shippingPrice.style.display = "none";

        document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
        document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
        document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;

        const shippingZip = document.getElementById('shipping-zip');
        if (shippingZip) shippingZip.value = "";
    }

    const deliveryModal = document.getElementById('deliveryModal');
    if (deliveryModal) {
        $('#deliveryModal').modal('hide');
    }
}
// Add this function to validate billing address fields
function validateBillingAddress() {
    const billingFormWrapper = document.getElementById('billing-address-form-wrapper');
    const billingRadio = document.querySelector('input[name="checkout[billing_same_as_shipping]"]:checked');

    // Only validate if "Use a different billing address" is selected
    if (!billingRadio || billingRadio.value !== 'false' || billingFormWrapper.style.display === 'none') {
        return true; // No validation needed if same as shipping
    }

    const requiredFields = [
        { id: 'billing-firstName', name: 'First Name' },
        { id: 'billing-lastName', name: 'Last Name' },
        { id: 'billing-phone', name: 'Phone' },
        { id: 'billing-address1', name: 'Address line 1' },
        { id: 'billing-country', name: 'Country/Region' },
        { id: 'billing-zip', name: 'Postcode' }
    ];

    let isValid = true;

    // Clear previous error states
    requiredFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.classList.remove('is-invalid');
        }
    });

    // Validate each required field
    requiredFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element && element.hasAttribute('required') && !element.value.trim()) {
            isValid = false;
            element.classList.add('is-invalid');
        }
    });

    return isValid;
}

// Add event listeners for real-time validation
document.addEventListener('DOMContentLoaded', function () {
    const billingRadios = document.querySelectorAll('input[name="checkout[billing_same_as_shipping]"]');
    const billingFormWrapper = document.getElementById('billing-address-form-wrapper');

    billingRadios.forEach(radio => {
        radio.addEventListener('change', function () {
            if (this.value === 'false') {
                billingFormWrapper.style.display = 'block';
            } else {
                billingFormWrapper.style.display = 'none';
                clearBillingValidationErrors();
            }
        });
    });

    // Real-time validation on blur
    const billingInputs = document.querySelectorAll('.billing-delay, .billing-immediate');
    billingInputs.forEach(input => {
        input.addEventListener('blur', function () {
            if (billingFormWrapper.style.display !== 'none' && this.hasAttribute('required')) {
                if (!this.value.trim()) {
                    this.classList.add('is-invalid');
                } else {
                    this.classList.remove('is-invalid');
                }
            }
        });

        input.addEventListener('input', function () {
            if (this.classList.contains('is-invalid') && this.value.trim()) {
                this.classList.remove('is-invalid');
            }
        });
    });
});

function clearBillingValidationErrors() {
    const billingInputs = document.querySelectorAll('.billing-delay, .billing-immediate');
    billingInputs.forEach(input => {
        input.classList.remove('is-invalid');
    });
}

function validatePickupForm() {
    const validations = [
        {
            id: 'receiver-detail-first_name',
            regex: /^[a-zA-Z ]+$/,
            message: 'Please enter a valid first name.',
            errorField: 'firstName'
        },
        {
            id: 'receiver-detail-last_name',
            regex: /^[a-zA-Z ]+$/,
            message: 'Please enter a valid last name.',
            errorField: 'lastName'
        },
        {
            id: 'receiver-detail-email',
            regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Please enter a valid email address.',
            errorField: 'email'
        },
        {
            id: 'billing-address1',
            regex: /^[a-zA-Z0-9\s,.-]+$/,
            message: 'Please enter a valid address.',
            errorField: 'address'
        },
        {
            id: 'billing-zip',
            regex: /^[0-9]{6}$/,
            message: 'Please enter a valid 6-digit postal code.',
            errorField: 'postalCode'
        },
        {
            id: 'receiver-detail-phone',
            regex: /^[0-9]{8}$/,
            message: 'Please enter a valid 8-digit phone number.',
            errorField: 'phone'
        }
    ];

    // Validate all fields
    for (let validation of validations) {
        const element = document.getElementById(validation.id);
        const value = element ? element.value.trim() : '';

        if (!value || !validation.regex.test(value)) {
            highlightError(element);
            scrollToElement(element);
            alert(validation.message);
            return false;
        } else {
            clearError(element);
        }
    }

    // Validate pickup date and time
    const collection_date = document.getElementById("datepicker").value;
    const collection_selectedOption = document.getElementById("dmeta3").value;

    if (!collection_date || !collection_selectedOption) {
        const datepicker = document.getElementById("datepicker");
        if (datepicker) {
            highlightError(datepicker);
            scrollToElement(datepicker);
        }
        alert("Both pick up date and collection time are required.");
        return false;
    }

    return true;
}
// Shipping Form Validation
function validateShippingForm() {
    const validations = [
        {
            id: 'shipping-email',
            regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Please enter a valid email address.',
            errorField: 'email'
        },
        {
            id: 'shipping-first_name',
            regex: /^[a-zA-Z ]+$/,
            message: 'Please enter a valid first name.',
            errorField: 'firstName'
        },
        {
            id: 'shipping-last_name',
            regex: /^[a-zA-Z ]+$/,
            message: 'Please enter a valid last name.',
            errorField: 'lastName'
        },
        {
            id: 'shipping-address1',
            regex: /^[a-zA-Z0-9\s,.\-#]+$/,
            message: 'Please enter a valid address.',
            errorField: 'address'
        },
        {
            id: 'shipping-zip',
            regex: /^[0-9]{6}$/,
            message: 'Please enter a valid 6-digit postal code.',
            errorField: 'postalCode'
        },
        {
            id: 'shipping-phone',
            regex: /^[0-9]{8}$/,
            message: 'Please enter a valid 8-digit phone number.',
            errorField: 'phone'
        }
    ];

    // Validate all shipping fields
    for (let validation of validations) {
        const element = document.getElementById(validation.id);
        const value = element ? element.value.trim() : '';

        if (!value || !validation.regex.test(value)) {
            highlightError(element);
            scrollToElement(element);
            alert(validation.message);
            return false;
        } else {
            clearError(element);
        }
    }

    // Validate billing address if different from shipping
    const billingRadio = document.querySelector('input[name="checkout[billing_same_as_shipping]"]:checked');
    if (billingRadio && billingRadio.value === 'false') {
        if (!validateBillingAddressFields()) {
            return false;
        }
    }

    // Validate delivery date and time
    const delivery_date_input = document.getElementById('appb9114bc45ab4c429_selected_date');
    const delivery_date = delivery_date_input ? delivery_date_input.value : null;
    const delivery_timeId = document.getElementById("dmeta2").value;

    if (!delivery_date || !delivery_timeId) {
        if (delivery_date_input) {
            highlightError(delivery_date_input);
            scrollToElement(delivery_date_input);
        }
        alert("Both shipping date and time are required.");
        return false;
    }

    return true;
}
// Validate billing address fields separately
function validateBillingAddressFields() {
    const billingValidations = [
        {
            id: 'billing-firstName',
            regex: /^[a-zA-Z ]+$/,
            message: 'Please enter a valid billing first name.'
        },
        {
            id: 'billing-lastName',
            regex: /^[a-zA-Z ]+$/,
            message: 'Please enter a valid billing last name.'
        },
        {
            id: 'billing-phone',
            regex: /^[0-9]{8}$/,
            message: 'Please enter a valid billing phone number.'
        },
        {
            id: 'billing-address1',
            regex: /^[a-zA-Z0-9\s,.\-#]+$/,
            message: 'Please enter a valid billing address.'
        },

        {
            id: 'billing-zip',
            regex: /^[0-9]{6}$/,
            message: 'Please enter a valid billing postal code.'
        }
    ];
    for (let validation of billingValidations) {
        const element = document.getElementById(validation.id);
        const value = element ? element.value.trim() : '';
        // Skip validation if field is optional and empty
        if (validation.optional && !value) {
            continue;
        }
        if (!value || !validation.regex.test(value)) {
            highlightError(element);
            scrollToElement(element);
            alert(validation.message);
            return false;
        } else {
            clearError(element);
        }
    }
    return true;
}

// Helper function to highlight error fields
function highlightError(element) {
    if (element) {
        element.classList.add('is-invalid');
        element.classList.add('border-danger');
    }
}

// Helper function to clear error styling
function clearError(element) {
    if (element) {
        element.classList.remove('is-invalid');
        element.classList.remove('border-danger');
    }
}

// Helper function to scroll to element
function scrollToElement(element) {
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => element.focus(), 300);
    }
}

// Add real-time validation for all input fields
document.addEventListener('DOMContentLoaded', function () {
    // Shipping fields
    const shippingFields = [
        'shipping-email', 'shipping-first_name', 'shipping-last_name',
        'shipping-address1', 'shipping-address2', 'shipping-zip', 'shipping-phone'
    ];

    // Billing fields
    const billingFields = [
        'billing-firstName', 'billing-lastName', 'billing-phone',
        'billing-address1', 'billing-address2', 'billing-zip'
    ];

    // Receiver fields (for pickup)
    const receiverFields = [
        'receiver-detail-first_name', 'receiver-detail-last_name',
        'receiver-detail-email', 'receiver-detail-phone'
    ];

    const allFields = [...shippingFields, ...billingFields, ...receiverFields];

    allFields.forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) {
            // Clear error on input
            element.addEventListener('input', function () {
                if (this.classList.contains('is-invalid')) {
                    clearError(this);
                }
            });

            // Validate on blur
            element.addEventListener('blur', function () {
                const value = this.value.trim();
                if (value) {
                    validateFieldOnBlur(this);
                }
            });
        }
    });
});

// Validate individual field on blur
function validateFieldOnBlur(element) {
    const fieldId = element.id;
    const value = element.value.trim();
    let isValid = true;

    // Define validation patterns
    const patterns = {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        name: /^[a-zA-Z ]+$/,
        address: /^[a-zA-Z0-9\s,.\-#]+$/,
        postalCode: /^[0-9]{6}$/,
        phone: /^[0-9]{8}$/
    };

    // Determine field type and validate
    if (fieldId.includes('email')) {
        isValid = patterns.email.test(value);
    } else if (fieldId.includes('first') || fieldId.includes('last') || fieldId.includes('Name')) {
        isValid = patterns.name.test(value);
    } else if (fieldId.includes('address')) {
        isValid = patterns.address.test(value) || value === '';
    } else if (fieldId.includes('zip')) {
        isValid = patterns.postalCode.test(value);
    } else if (fieldId.includes('phone')) {
        isValid = patterns.phone.test(value);
    }

    if (!isValid) {
        highlightError(element);
    } else {
        clearError(element);
    }
}

async function postCartItem() {

    // ─── CONSTANTS ────────────────────────────────────────────────────────────
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const cartPriceAmount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];

    // ─── FORM VALUES ─────────────────────────────────────────────────────────
    const email = document.getElementById("shipping-email").value;
    const firstName = document.getElementById("shipping-first_name").value;
    const lastName = document.getElementById("shipping-last_name").value;
    const address = document.getElementById("shipping-address1").value;
    const address2 = document.getElementById("shipping-address2").value;
    const second_address = document.getElementById("billing-address1").value || "";
    const second_address2 = document.getElementById("billing-address2").value || "";
    const postalcode = document.getElementById("shipping-zip").value || "";
    const second_postalCode = document.getElementById("billing-zip").value || "";
    const phone = document.getElementById("shipping-phone").value;
    const remarks = document.getElementById("remark").value || "";

    const delivery_date_input = document.getElementById("appb9114bc45ab4c429_selected_date");
    const delivery_date = delivery_date_input ? delivery_date_input.value : null;
    const freeDeliveryPromo = sessionStorage.getItem("freeDeliveryPromo");

    // ─── ADD-ONS ─────────────────────────────────────────────────────────────
    const smallCandle = getSelectedData("smallCandle");
    const bigCandle = getSelectedData("bigCandle");
    const HbdTag = getSelectedData("HbdTag");

    const isGift = { text: "", value: "" };
    const giftEl = document.getElementById("isGift");
    if (giftEl) {
        isGift.text = giftEl.options[giftEl.selectedIndex].text;
        isGift.value = giftEl.value;
    }

    // ─── DELIVERY TIME ────────────────────────────────────────────────────────
    let delivery_timeId = "";
    const selectedOption = document.getElementById("dmeta2").value;
    if (selectedOption) {
        try {
            const fixedValue = selectedOption.replace(/&quot;/g, '"').replace(/"null"/g, "null");
            delivery_timeId = JSON.parse(fixedValue).item_id;
        } catch (err) {
            console.error("❌ delivery time JSON parse failed:", err);
        }
    } else {
        console.warn("⚠️ No delivery time selected.");
    }

    // ─── TODAY'S DATE ────────────────────────────────────────────────────────
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // ─── XML ESCAPE ──────────────────────────────────────────────────────────
    function escapeXML(str) {
        if (str === null || str === undefined) return "";
        return String(str).replace(/[<>&'"]/g, c =>
            ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c])
        );
    }

    const freeDeliveryTag = (freeDeliveryPromo != null && freeDeliveryPromo !== "null")
        ? "<no_deliverycharge>Y</no_deliverycharge>"
        : "<no_deliverycharge>N</no_deliverycharge>";

    // ─── RECALCULATE ITEMS SUBTOTAL FROM CART (source of truth) ──────────────
    // Excludes cooler bag items. Includes icing charges only when an icing image exists.
    function recalcItemsSubtotal() {
        let sub = 0;
        cart.forEach(item => {
            if (item.packageName?.toLowerCase().includes("cooler")) return;
            sub += parseFloat(item.itemPrice || 0) * (item.quantity || 1);
            if (item.IcingCharges && item.IcingImage && item.IcingImage !== "null") {
                sub += parseFloat(item.IcingCharges || 0) * (item.quantity || 1);
            }
        });
        return sub;
    }

    // ─── ADD-ON DETAIL LINES ─────────────────────────────────────────────────
    function buildAddonDetails(orgId, delGrpNo, startLineNo, itemName) {
        let xml = "";
        let lineNo = startLineNo;

        if (smallCandle?.quantity > 0) {
            xml += `
        <details>
            <org_id>${orgId}</org_id>
            <del_grp_no>${delGrpNo}</del_grp_no>
            <line_no>${lineNo++}</line_no>
            <product_id>${smallCandle.value}</product_id>
            <product_desc>Candles Small 2.5</product_desc>
            <product_type>Candles</product_type>
            <group_name>${escapeXML(itemName)}</group_name>
            <qty_order>${smallCandle.quantity}</qty_order>
            <uom_id>${smallCandle.uom}</uom_id>
            <unit_price>0</unit_price>
            <remarks></remarks>
        </details>`;
        }

        if (bigCandle?.quantity > 0) {
            xml += `
        <details>
            <org_id>${orgId}</org_id>
            <del_grp_no>${delGrpNo}</del_grp_no>
            <line_no>${lineNo++}</line_no>
            <product_id>${bigCandle.value}</product_id>
            <product_desc>Candles Big 3.5</product_desc>
            <product_type>Candles</product_type>
            <group_name>Candles</group_name>
            <qty_order>${bigCandle.quantity}</qty_order>
            <uom_id>${bigCandle.uom}</uom_id>
            <unit_price>0</unit_price>
            <remarks></remarks>
        </details>`;
        }

        if (HbdTag?.quantity > 0) {
            xml += `
        <details>
            <org_id>${orgId}</org_id>
            <del_grp_no>${delGrpNo}</del_grp_no>
            <line_no>${lineNo++}</line_no>
            <product_id>${HbdTag.value}</product_id>
            <product_desc>Happy Birthday Tag</product_desc>
            <product_type>Happy Birthday</product_type>
            <group_name>Happy Birthday</group_name>
            <qty_order>${HbdTag.quantity}</qty_order>
            <uom_id>${HbdTag.uom}</uom_id>
            <unit_price>0</unit_price>
            <remarks></remarks>
        </details>`;
        }

        return { xml, lineNo };
    }


    // ═══════════════════════════════════════════════════════════════════════════
    // PICKUP FLOW
    // ═══════════════════════════════════════════════════════════════════════════
    const pickupChecked = document.querySelector('input[name="base_delivery_method"][value="pickup"]:checked');

    if (pickupChecked) {

        if (!validatePickupForm()) return false;

        // Pickup-specific fields
        const sfirstName = document.getElementById("receiver-detail-first_name").value || "";
        const slastName = document.getElementById("receiver-detail-last_name").value || "";
        const sEmail = document.getElementById("receiver-detail-email").value || "";
        const sphone = document.getElementById("receiver-detail-phone").value || "";
        const warehouse = localStorage.getItem("warehouseId");
        const collection_date = document.getElementById("datepicker").value;

        let collection_timeId = "";
        try {
            const rawVal = document.getElementById("dmeta3").value.replace(/undefined/g, "null");
            collection_timeId = JSON.parse(rawVal)?.item_id || "";
        } catch (err) {
            console.error("❌ collection time JSON parse failed:", err);
        }

        // ── Pickup totals: items + GST, then subtract discount ────────────────
        const itemsSubtotal = recalcItemsSubtotal();
        const Tax = parseFloat((itemsSubtotal * gst).toFixed(2));
        let grandTotal = parseFloat((itemsSubtotal + Tax).toFixed(2));
        let discountAmt = 0;

        if (cartPriceAmount.length > 0 && cartPriceAmount[0].discountCode) {
            discountAmt = parseFloat(cartPriceAmount[0].discountAmt) || 0;
            grandTotal = parseFloat((grandTotal - discountAmt).toFixed(2));
        }

        // Store unambiguous payment amount for sendPayLoad
        sessionStorage.setItem("paymentAmount", grandTotal.toFixed(2));

        console.log("✅ [PICKUP] itemsSubtotal:", itemsSubtotal.toFixed(2),
            "| Tax:", Tax.toFixed(2),
            "| Discount:", discountAmt.toFixed(2),
            "| Grand Total:", grandTotal.toFixed(2));

        // ── Build XML ─────────────────────────────────────────────────────────
        let deliveryGroups = "";
        let detailsGroups = "";
        let lineNo = 1;

        cart.forEach((item, index) => {
            const delGrpNo = index + 1;

            // Cooler bag — detail line only, no delivery group
            if (item.packageName?.toLowerCase().includes("cooler")) {
                detailsGroups += `
        <details>
            <org_id>${orgId}</org_id>
            <del_grp_no>${index}</del_grp_no>
            <line_no>${lineNo++}</line_no>
            <product_id>${item.productId}</product_id>
            <product_desc>${escapeXML(item.packageName)}</product_desc>
            <product_type>${escapeXML(item.packageType)}</product_type>
            <group_name>${escapeXML(item.packageName)}</group_name>
            <qty_order>${item.quantity}</qty_order>
            <uom_id>${item.itemUOM}</uom_id>
            <unit_price>${item.itemPrice}</unit_price>
            <remarks></remarks>
        </details>`;
                return;
            }

            // Shared delivery group for both icing and standard items
            deliveryGroups += `
        <deliverygroup>
            <event_title>${item.menuPackage}</event_title>
            <del_grp_no>${delGrpNo}</del_grp_no>
            <menucatg_id>${item.productId}</menucatg_id>
            <menupkg_id>${item.menuPackage}</menupkg_id>
            <no_of_pax>1</no_of_pax>
            <total>${item.quantity}</total>
            <unitprice>0</unitprice>
            <event_date>${collection_date}</event_date>
            <eventtime_id>${collection_timeId}</eventtime_id>
            <hascollection>N</hascollection>
            <collection_date></collection_date>
            <collectiontime_id></collectiontime_id>
            <haspickup>Y</haspickup>
            <pickup_location>${warehouse}</pickup_location>
            <remarks></remarks>
            <isgift>${escapeXML(isGift.value)}</isgift>
            <cakesampleimage>${item.IcingImage && item.IcingImage !== "null" ? item.IcingImage : ""}</cakesampleimage>
        </deliverygroup>`;

            // Cake detail line
            detailsGroups += `
        <details>
            <org_id>${orgId}</org_id>
            <del_grp_no>${delGrpNo}</del_grp_no>
            <line_no>${lineNo++}</line_no>
            <product_id>${item.sizeID || item.productId}</product_id>
            <product_desc>${escapeXML(item.packageName)}</product_desc>
            <product_type>${escapeXML(item.packageType)}</product_type>
            <group_name>${escapeXML(item.packageName)}</group_name>
            <qty_order>${item.quantity}</qty_order>
            <uom_id>${item.itemUOM}</uom_id>
            <unit_price>${item.itemPrice}</unit_price>
            <remarks></remarks>
            <cakewriting>${item.cakeWriting ? `Cake Writing : ${escapeXML(item.cakeWriting)}` : ""}</cakewriting>
        </details>`;

            // Icing charge line (only when icing image exists)
            if (item.IcingImage && item.IcingImage !== "null") {
                detailsGroups += `
        <details>
            <org_id>${orgId}</org_id>
            <del_grp_no>${delGrpNo}</del_grp_no>
            <line_no>${lineNo++}</line_no>
            <product_id>${item.IcingProduct}</product_id>
            <product_desc>${escapeXML(item.packageName)}</product_desc>
            <product_type>${escapeXML(item.packageType)}</product_type>
            <group_name>${escapeXML(item.packageName)}</group_name>
            <qty_order>${item.quantity}</qty_order>
            <uom_id>${item.IcingUOM}</uom_id>
            <unit_price>${item.IcingCharges}</unit_price>
            <remarks></remarks>
        </details>`;
            }

            // Add-ons (candles, HBD tag)
            const addons = buildAddonDetails(orgId, delGrpNo, lineNo, item.packageName);
            detailsGroups += addons.xml;
            lineNo = addons.lineNo;
        });

        const xmlData = `<?xml version="1.0"?>
<plist>
    <array>
        <master>
            <org_id>${orgId}</org_id>
            <order_date>${today}</order_date>
            <customer_name>${escapeXML(`${sfirstName} ${slastName}`)}</customer_name>
            <address1>${escapeXML(second_address)}</address1>
            <address2>${escapeXML(second_address2)}</address2>
            <postal_code>${escapeXML(second_postalCode)}</postal_code>
            <email>${escapeXML(sEmail)}</email>
            <phone_no>${escapeXML(sphone)}</phone_no>
            <cont_name>${escapeXML(sfirstName)}</cont_name>
            <cont_lastname>${escapeXML(slastName)}</cont_lastname>
            <curr_code>SGD</curr_code>
            <exch_rate>1.000000</exch_rate>
            <total>${grandTotal.toFixed(2)}</total>
            <absorb_tax>${gst}</absorb_tax>
            <disc_amt>${discountAmt.toFixed(2)}</disc_amt>
            <tax_amt>${Tax.toFixed(2)}</tax_amt>
            <payment_mode></payment_mode>
            <payment_refenceno></payment_refenceno>
            <payment_method></payment_method>
            <type_of_sales>WEB</type_of_sales>
            <scustomer_name>${escapeXML(`${sfirstName} ${slastName}`)}</scustomer_name>
            <saddress1>${escapeXML(second_address)}</saddress1>
            <saddress2>${escapeXML(second_address2)}</saddress2>
            <spostal_code>${escapeXML(second_postalCode)}</spostal_code>
            <sphone_no>${escapeXML(sphone)}</sphone_no>
            <scont_name>${escapeXML(sfirstName)}</scont_name>
            <scont_lastname>${escapeXML(slastName)}</scont_lastname>
            <delivery_lift_landing>N</delivery_lift_landing>
            <delivery_lift_level_id></delivery_lift_level_id>
            <remarks_one>${escapeXML(remarks)}</remarks_one>
            <remarks_two>Is Gift ? : ${escapeXML(isGift.text)}</remarks_two>
            <payment_success></payment_success>
        </master>
        ${deliveryGroups}
        ${detailsGroups}
    </array>
</plist>`;

        return await logAndReturn(xmlData);
    }


    // ═══════════════════════════════════════════════════════════════════════════
    // SHIPPING FLOW
    // ═══════════════════════════════════════════════════════════════════════════

    if (!validateShippingForm()) return false;

    const specialAreaInfo = JSON.parse(sessionStorage.getItem("specialAreaInfo")) || null;
    const normalAreaInfo = JSON.parse(sessionStorage.getItem("normalAreaInfo")) || null;
    const areaInfo = specialAreaInfo || normalAreaInfo;

    // ── Lift charge setup ─────────────────────────────────────────────────────
    const LiftInLevel = document.getElementById("isunitatliftlevel").value || "";
    const isLift = LiftInLevel === "Y" ? "N" : "Y";
    let liftID = "";

    if (LiftInLevel !== "Y") {
        try {
            const rawLift = document.getElementById("floorlevelcharges").value || "";
            const parsed = JSON.parse(rawLift.replace(/undefined/g, "null"));
            liftID = parsed?.item_no || "";
        } catch (err) {
            console.error("❌ liftID JSON parse failed:", err);
        }
    }

    // ── Billing address resolution ────────────────────────────────────────────
    const billingFirstName = document.getElementById("billing-firstName").value || firstName;
    const billingLastName = document.getElementById("billing-lastName").value || lastName;
    const billingPhone = document.getElementById("billing-phone").value || phone;

    const billingRadio = document.querySelector('input[name="checkout[billing_same_as_shipping]"]:checked');
    const useDifferentBilling = billingRadio?.value === "false";

    const primaryCustomerName = useDifferentBilling ? `${billingFirstName} ${billingLastName}` : `${firstName} ${lastName}`;
    const primaryAddress1 = useDifferentBilling ? second_address : address;
    const primaryAddress2 = useDifferentBilling ? second_address2 : address2;
    const primaryPostalCode = useDifferentBilling ? second_postalCode : postalcode;
    const primaryPhone = useDifferentBilling ? billingPhone : phone;
    const primaryContactFirstName = useDifferentBilling ? billingFirstName : firstName;
    const primaryContactLastName = useDifferentBilling ? billingLastName : lastName;

    // ── Shipping totals ───────────────────────────────────────────────────────
    // itemsSubtotal: pure item prices from cart, no tax, no delivery
    // "Shipping" session key: area charge + lift (set by sortAndRender / calLiftChargeFee)
    // Tax applies to BOTH items and delivery combined (Singapore GST requirement)
    const itemsSubtotal = recalcItemsSubtotal();
    // "Shipping" already contains area + lift combined — do not add lift again
    const deliveryCharge = parseFloat(sessionStorage.getItem("Shipping")) || 0;

    let taxableItems = itemsSubtotal;
    let taxableDelivery = deliveryCharge;
    let discountAmt = 0;

    if (cartPriceAmount.length > 0 && cartPriceAmount[0].discountCode) {
        const discountPercent = parseFloat(cartPriceAmount[0].discountPercentage) || 0;
        // Use pre-discounted subtotal stored by the voucher logic
        taxableItems = parseFloat(cartPriceAmount[0].disSubTotal) || itemsSubtotal;
        // Apply same discount percentage to delivery
        taxableDelivery = parseFloat((deliveryCharge * (1 - discountPercent)).toFixed(2));
        discountAmt = parseFloat(cartPriceAmount[0].discountAmt) || 0;
    }

    // ✅ Tax on items + delivery combined
    const Tax = parseFloat(((taxableItems + taxableDelivery) * gst).toFixed(2));
    const grandTotal = parseFloat((taxableItems + taxableDelivery + Tax).toFixed(2));

    // Store unambiguous payment amount for sendPayLoad
    sessionStorage.setItem("paymentAmount", grandTotal.toFixed(2));

    console.log("✅ [SHIPPING]",
        "| Items:", taxableItems.toFixed(2),
        "| Delivery:", taxableDelivery.toFixed(2),
        "| Tax:", Tax.toFixed(2),
        "| Discount:", discountAmt.toFixed(2),
        "| Grand Total:", grandTotal.toFixed(2));

    // ── Build shipping XML ────────────────────────────────────────────────────
    let deliveryGroups = "";
    let detailsGroups = "";
    let lineNo = 1;
    let count = 1;    // tracks last del_grp_no for the delivery charge line

    cart.forEach((item, index) => {
        const delGrpNo = index + 1;

        // Cooler bag — detail only, no delivery group
        if (item.packageName?.toLowerCase().includes("cooler")) {
            detailsGroups += `
        <details>
            <org_id>${orgId}</org_id>
            <del_grp_no>${index}</del_grp_no>
            <line_no>${lineNo++}</line_no>
            <product_id>${item.productId}</product_id>
            <product_desc>${escapeXML(item.packageName)}</product_desc>
            <product_type>${escapeXML(item.packageType)}</product_type>
            <group_name>${escapeXML(item.packageName)}</group_name>
            <qty_order>${item.quantity}</qty_order>
            <uom_id>${item.itemUOM}</uom_id>
            <unit_price>${item.itemPrice}</unit_price>
            <remarks></remarks>
        </details>`;
            return;
        }

        // ── Delivery group (shared structure for icing and standard) ──────────
        deliveryGroups += `
        <deliverygroup>
            <event_title>${item.menuPackage}</event_title>
            <del_grp_no>${delGrpNo}</del_grp_no>
            <menucatg_id>${item.productId}</menucatg_id>
            <menupkg_id>${item.menuPackage}</menupkg_id>
            <no_of_pax>1</no_of_pax>
            <total>${item.quantity}</total>
            <unitprice>0</unitprice>
            <event_date>${delivery_date}</event_date>
            <eventtime_id>${delivery_timeId}</eventtime_id>
            <hascollection>N</hascollection>
            <collection_date></collection_date>
            <collectiontime_id></collectiontime_id>
            <haspickup>N</haspickup>
            <pickup_location></pickup_location>
            <remarks></remarks>
            <isgift>${escapeXML(isGift.value)}</isgift>
            <cakesampleimage>${item.IcingImage && item.IcingImage !== "null" ? item.IcingImage : ""}</cakesampleimage>
            ${freeDeliveryTag}
        </deliverygroup>`;
        count++;

        // ── Cake detail line ──────────────────────────────────────────────────
        // FIX: lineNo is NOT reset here — it continues from the previous item
        detailsGroups += `
        <details>
            <org_id>${orgId}</org_id>
            <del_grp_no>${delGrpNo}</del_grp_no>
            <line_no>${lineNo++}</line_no>
            <product_id>${item.sizeID || item.productId}</product_id>
            <product_desc>${escapeXML(item.packageName)}</product_desc>
            <product_type>${escapeXML(item.packageType)}</product_type>
            <group_name>${escapeXML(item.packageName)}</group_name>
            <qty_order>${item.quantity}</qty_order>
            <uom_id>${item.itemUOM}</uom_id>
            <unit_price>${item.itemPrice}</unit_price>
            <remarks></remarks>
            <isdcharge>N</isdcharge>
            <cakewriting>${item.cakeWriting ? `Cake Writing : ${escapeXML(item.cakeWriting)}` : ""}</cakewriting>
        </details>`;

        // ── Icing charge line (only when icing image exists) ─────────────────
        if (item.IcingImage && item.IcingImage !== "null") {
            detailsGroups += `
        <details>
            <org_id>${orgId}</org_id>
            <del_grp_no>${delGrpNo}</del_grp_no>
            <line_no>${lineNo++}</line_no>
            <product_id>${item.IcingProduct}</product_id>
            <product_desc>${escapeXML(item.packageName)}</product_desc>
            <product_type>${escapeXML(item.packageType)}</product_type>
            <group_name>${escapeXML(item.packageName)}</group_name>
            <qty_order>${item.quantity}</qty_order>
            <uom_id>${item.IcingUOM}</uom_id>
            <unit_price>${item.IcingCharges}</unit_price>
            <remarks></remarks>
            <isdcharge>N</isdcharge>
        </details>`;
        }

        // ── Add-ons ───────────────────────────────────────────────────────────
        const addons = buildAddonDetails(orgId, delGrpNo, lineNo, item.packageName);
        detailsGroups += addons.xml;
        lineNo = addons.lineNo;
    });

    // ── Delivery charge line (appended once, after all cart items) ────────────
    if (areaInfo) {
        detailsGroups += `
        <details>
            <org_id>${orgId}</org_id>
            <del_grp_no>${count - 1}</del_grp_no>
            <line_no>${lineNo++}</line_no>
            <product_id>${areaInfo.productID}</product_id>
            <product_desc>${escapeXML(areaInfo.product_desc)}</product_desc>
            <group_name>Delivery Charge</group_name>
            <qty_order>1</qty_order>
            <uom_id>${areaInfo.uomId}</uom_id>
            <unit_price>${deliveryCharge.toFixed(2)}</unit_price>
            <remarks></remarks>
            <isdcharge>Y</isdcharge>
        </details>`;
    }

    const xmlData = `<?xml version="1.0"?>
<plist>
    <array>
        <master>
            <org_id>${orgId}</org_id>
            <order_date>${today}</order_date>
            <customer_name>${escapeXML(primaryCustomerName)}</customer_name>
            <address1>${escapeXML(primaryAddress1)}</address1>
            <address2>${escapeXML(primaryAddress2)}</address2>
            <postal_code>${escapeXML(primaryPostalCode)}</postal_code>
            <email>${escapeXML(email)}</email>
            <phone_no>${escapeXML(primaryPhone)}</phone_no>
            <cont_name>${escapeXML(primaryContactFirstName)}</cont_name>
            <cont_lastname>${escapeXML(primaryContactLastName)}</cont_lastname>
            <curr_code>SGD</curr_code>
            <exch_rate>1.000000</exch_rate>
            <total>${grandTotal.toFixed(2)}</total>
            <absorb_tax>${gst}</absorb_tax>
            <disc_amt>${discountAmt.toFixed(2)}</disc_amt>
            <tax_amt>${Tax.toFixed(2)}</tax_amt>
            <payment_mode></payment_mode>
            <payment_refenceno></payment_refenceno>
            <payment_method></payment_method>
            <scustomer_name>${escapeXML(`${firstName} ${lastName}`)}</scustomer_name>
            <saddress1>${escapeXML(address)}</saddress1>
            <saddress2>${escapeXML(address2)}</saddress2>
            <spostal_code>${escapeXML(postalcode)}</spostal_code>
            <sphone_no>${escapeXML(phone)}</sphone_no>
            <scont_name>${escapeXML(firstName)}</scont_name>
            <scont_lastname>${escapeXML(lastName)}</scont_lastname>
            <delivery_lift_landing>${isLift}</delivery_lift_landing>
            <delivery_lift_level_id>${liftID}</delivery_lift_level_id>
            <remarks_one>${escapeXML(remarks)}</remarks_one>
            <remarks_two>Is Gift ? : ${escapeXML(isGift.text)}</remarks_two>
            <payment_success></payment_success>
        </master>
        ${deliveryGroups}
        ${detailsGroups}
    </array>
</plist>`;

    return await logAndReturn(xmlData);


    // ─── SHARED: LOG XML THEN RETURN TRUE ────────────────────────────────────
    async function logAndReturn(xmlData) {
        sessionStorage.setItem("xmlData", xmlData);

        const pendingTxnRef = sessionStorage.getItem("pendingTxnRef");
        console.log("📦 Logging XML with txnRef:", pendingTxnRef);

        try {
            await fetch("/SR/LogXmlBeforePayment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: xmlData, txnRef: pendingTxnRef })
            });
        } catch (err) {
            console.warn("⚠️ XML logging failed (non-blocking):", err);
        }

        return true;
    }
}

function getSelectedData(id) {
    const el = document.getElementById(id);
    if (!el) return null;

    const option = el.options[el.selectedIndex];
    if (!option) return null;

    return {
        value: option.value,
        quantity: option.getAttribute("quantity"),
        uom: option.getAttribute("uom")
    };
}


const placeOrderBtn = document.getElementById("place-order");
const ajaxResponse = document.getElementById("ajaxResponse");



async function sendPayLoad(event) {
    event.preventDefault();

    // ── Validate billing address ──────────────────────────────────────────────
    if (!validateBillingAddress()) {
        console.log("Billing address validation failed.");
        document.getElementById("billing-address-section")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
    }

    // ── Generate txnRef BEFORE postCartItem ───────────────────────────────────
    const now = new Date();
    const txnRef = now.toISOString()
        .replace("T", "_")
        .replace(/:/g, "")
        .replace(/\..+/, "")
        .replace(/-/g, "_");
    sessionStorage.setItem("pendingTxnRef", txnRef);

    // ── Build and log XML ─────────────────────────────────────────────────────
    const cartValid = await postCartItem();
    if (!cartValid) {
        console.log("Cart validation failed.");
        return;
    }

    // ── Lock UI while payment processes ───────────────────────────────────────
    document.getElementById("placeOrderDiv").style.display = "none";
    document.getElementById("payment-warning").style.display = "block";
    setFormReadOnly("checkOutForm", true);

    function unlockForm() {
        setFormReadOnly("checkOutForm", false);
        document.getElementById("placeOrderDiv").style.display = "block";
        document.getElementById("payment-warning").style.display = "none";
    }

    function proceedWithAjax() {

        // ✅ FIX: read paymentAmount — always the grand total matching #total-price
        // postCartItem() sets this after recalculating from cart + delivery
        // checkout() also seeds it so the value survives even if postCartItem hasn't run yet
        const amount = parseFloat(sessionStorage.getItem("paymentAmount"));

        if (isNaN(amount) || amount <= 0) {
            console.error("❌ Invalid paymentAmount:", amount);
            alert("Unable to read payment amount. Please refresh and try again.");
            unlockForm();
            return;
        }

        // Sanity check: warn if amount doesn't match what #total-price shows
        const displayedTotal = parseFloat(
            (document.getElementById("total-price")?.textContent || "0")
                .replace(/[^\d.]/g, "")
        );
        if (Math.abs(amount - displayedTotal) > 0.01) {
            console.warn(`⚠️ Amount mismatch — paymentAmount: ${amount}, #total-price: ${displayedTotal}`);
        }

        console.log(`✅ Sending to NETS — amount: SGD$ ${amount.toFixed(2)}, txnRef: ${txnRef}`);

        const payload = { amount, txnRef };

        $.ajax({
            type: "POST",
            url: "/SR/PaymentGenerateTxnReq",
            contentType: "application/json; charset=UTF-8",
            dataType: "json",
            data: JSON.stringify(payload),

            success: function (data) {
                const msgData = data?.response?.msg;
                if (!msgData) {
                    writeErrorInfo("0010-50001", "2");
                    return unlockForm();
                }
                if (!msgData.merchantSvcList || msgData.merchantSvcList.length === 0) {
                    handleErrorPath(msgData);
                    return unlockForm();
                }
                $("#ajaxResponse").show();
                processServiceList(JSON.stringify(msgData), null, null, null);
                openPaymentModal();
            },

            error: function (jqXHR) {
                const msg = jqXHR.responseText || "Unknown error";
                if (msg.includes("Service Not Available")) {
                    $("#ajaxResponse").append(msg);
                } else {
                    writeErrorInfo("0010-50001", "3");
                }
                unlockForm();
            }
        });
    }

    // Load jQuery if not already available then proceed
    if (typeof jQuery === "undefined") {
        const script = document.createElement("script");
        script.src = gwdomain + "/GW2/js/jquery-3.6.3.min.js";
        script.onload = proceedWithAjax;
        document.head.appendChild(script);
    } else {
        proceedWithAjax();
    }

    function handleErrorPath(msgData) {
        $("#ajaxResponse").empty();
        if (msgData.stageRespCode) {
            if (!msgData.b2sTxnEndURL) {
                writeErrorInfo(msgData.stageRespCode, msgData.actionCode);
            } else if (msgData.allDistraFlag === "Y" || (msgData.hmac && msgData.rawMsg)) {
                processErrorPage(JSON.stringify(msgData), null, null, null);
            } else {
                writeErrorInfo(msgData.stageRespCode, msgData.actionCode);
            }
        } else {
            $("#ajaxResponse").append(msgData.netsTxnMsg);
        }
    }
}
function openPaymentModal() {
    console.log("Opening payment modal");
    ajaxResponse.style.display = "block";
}

function closePaymentModal() {
    window.location.href = "/SecretRecipe/Checkout";
    console.log("Closing payment modal");
    ajaxResponse.style.display = "none";
}


function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}


function calculateSpecialCharges(postal) {
    return new Promise((resolve) => {
        const is6R = sessionStorage.getItem("6R") === "Yes";
        const cached = JSON.parse(sessionStorage.getItem("specialAreaInfo") || "null");
        const hasValidCharge = Number.isFinite(cached?.charges);
        const matchesThisPostal = cached?.matchKey && String(postal).startsWith(String(cached.matchKey));

        //if (hasValidCharge && matchesThisPostal) {
        //    console.log(`♻️ Using existing special charges for ${cached.areaName} (key ${cached.matchKey})`);

        //    // 6R override
        //    const chargeToUse = is6R ? price6R : cached.charges;
        //    updateUIWithCharges(chargeToUse);
        //    resolve(true);
        //    return;
        //}

        if (hasValidCharge) {
            if (matchesThisPostal) {
                console.log(`♻️ Using existing special charges for ${cached.areaName} (key ${cached.matchKey})`);
                const chargeToUse = is6R ? price6R : cached.charges;
                updateUIWithCharges(chargeToUse);
                resolve(true);
                return;
            }
            else {
                console.log(`🧹 Clearing stale special cache: key ${cached.matchKey} not for ${postal}`);
                sessionStorage.removeItem("specialAreaInfo");
                sessionStorage.removeItem("specialArea");
            }

        }

        $.ajax({
            type: "GET",
            url: `/SR/CalAreaSpecialCharges?postal=${postal}`,
            success: function (data) {
                try {
                    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                    const responseData = parsedData?.response?.data;
                    if (!Array.isArray(responseData) || responseData.length === 0) {
                        console.log("⏩ Empty response - skipping update");
                        resolve(false);
                        return;
                    }

                    const zoneData = responseData[0];
                    const deliveryCharges = parseFloat(zoneData?.charges ?? NaN);
                    const deliveryArea = zoneData?.areaName || zoneData?.deliveryZone || zoneData?.specificAreas || zoneData?.description;
                    if (!deliveryArea || !Number.isFinite(deliveryCharges)) {
                        console.log("❌ Invalid special area data");
                        resolve(false);
                        return;
                    }

                    // Cache
                    const specialAreaInfo = {
                        areaName: deliveryArea,
                        startingTime: zoneData.startingTime,
                        endingTime: zoneData.endingTime,
                        charges: deliveryCharges,
                        matchKey: String(postal),
                        uomId: zoneData?.uOM,
                        uom_Identifier: zoneData?.uOM$_identifier,
                        productID: zoneData?.chargedProduct,
                        product_desc: zoneData?.chargedProduct$_identifier
                    };
                    sessionStorage.setItem("specialAreaInfo", JSON.stringify(specialAreaInfo));
                    sessionStorage.setItem("specialArea", deliveryArea);

                    // 6R override
                    const chargeToUse = is6R ? price6R : deliveryCharges;
                    console.log(`✅ New special area detected: ${deliveryArea} ($${chargeToUse}) [key ${specialAreaInfo.matchKey}]`);
                    updateUIWithCharges(chargeToUse);
                    resolve(true);

                } catch (err) {
                    console.error("Special charge error:", err);
                    resolve(false);
                }
            },
            error: function () {
                console.error("Failed to retrieve special charges.");
                resolve(false);
            }
        });
    });
}

// Your original UI update logic (preserved exactly)
function updateUIWithCharges(deliveryCharges) {
    try {
        // 1. Safely parse currency values (iOS/Android compatible)
        const parseCurrency = (value) => {
            if (typeof value !== 'string') value = String(value || '0');
            return parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
        };

        // 2. Format currency display consistently
        const formatCurrency = (amount) => {
            return `SGD$ ${(amount || 0).toLocaleString('en-SG', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
        };

        // 3. Initialize UI - remove loading states
        document.getElementById("summary")?.classList.remove("skeleton-loading");
        document.body.style.overflow = "auto";

        // 4. Get values with null checks and fallbacks
        const lift = document.getElementById("isunitatliftlevel")?.value || "Y";
        const subTotalText = document.getElementById("subTotal")?.textContent || "0.00";
        const subtotal = parseCurrency(subTotalText);
        const liftCharges = parseCurrency(sessionStorage.getItem("liftCharges"));
        const cartDiscount = JSON.parse(localStorage.getItem("cartDiscountAmount") || "[]")[0] || {};

        // 5. Calculate charges with lift consideration
        let totalCharges = parseCurrency(deliveryCharges);
        if (lift === "N") {
            totalCharges += parseCurrency(liftCharges);
        }

        // 6. Calculate financials using global gst variable
        let tax, total;
        if (cartDiscount.discountPercentage) {
            const discountPercent = parseCurrency(cartDiscount.discountPercentage) / 100;
            const discountedCharges = totalCharges * (1 - discountPercent);

            tax = (parseCurrency(cartDiscount.disSubTotal || subtotal) + discountedCharges) * gst;
            total = parseCurrency(cartDiscount.disSubTotal || subtotal) + discountedCharges + tax;

            cartDiscount.discountAmt = parseCurrency(cartDiscount.discountAmt) + (totalCharges * discountPercent);
            localStorage.setItem("cartDiscountAmount", JSON.stringify([cartDiscount]));
        } else {
            tax = (subtotal + totalCharges) * gst;
            total = subtotal + totalCharges + tax;
        }

        // 7. Safe UI update function
        const updateSafeText = (selector, text) => {
            const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (el) el.textContent = text;
        };

        // 8. Update all price displays
        updateSafeText("#shippingPrice", formatCurrency(totalCharges));
        updateSafeText("#shipping-price", `Charge : ${formatCurrency(totalCharges)}`);
        updateSafeText(".total-line-tax_price", formatCurrency(tax));
        updateSafeText("#total-price", formatCurrency(total));
        updateSafeText("#summary-toggle-total-price", formatCurrency(total));

        // 9. Update session storage
        // ✅ FIX: Store actual subtotal, not total — tax & shipping are separate
        sessionStorage.setItem("Tax", tax.toFixed(2));
        sessionStorage.setItem("Shipping", totalCharges.toFixed(2));
        sessionStorage.setItem("SubTotal", subtotal.toFixed(2));

        // 10. Toggle shipping UI elements
        const shippingElements = {
            "#shipping-methods-content": "block",
            "#shipping-price-info": "block",
            "#shipping-methods-placeholder": "none",
            "#shippingDesc": "none",
            "#shippingPrice": "block"
        };

        Object.entries(shippingElements).forEach(([id, display]) => {
            const el = document.querySelector(id);
            if (el) el.style.display = display;
        });

    } catch (error) {
        console.error("Error in updateUIWithCharges:", error);
        document.getElementById("shippingPrice").textContent = "Error calculating charges";
        document.body.style.overflow = "auto";
    } finally {
        setTimeout(() => {
            document.getElementById("summary")?.classList.remove("skeleton-loading");
        }, 3000);
    }
}

// === Debounced input handler ===
function validatePostalCode(postalCode) {
    if (!postalCode) {
        console.log('🔄 Empty postal code - resetting');
        resetShippingAndEvents();
        return false;
    }

    // Allow partial (2-5 digits) or complete (6 digits) codes
    if (!/^\d{2,6}$/.test(postalCode)) {
        console.log(`❌ Invalid format (${postalCode}) - need 2-6 digits`);
        resetShippingAndEvents();
        return false;
    }

    return true;
}

async function processPostalCode(postalCode) {
    try {
        console.log('ℹ️ Processing postal code:', postalCode);

        const is6R = sessionStorage.getItem("6R") === "Yes";

        // Step 1: If 6R, force delivery charge = 25
        if (is6R) {
            const deliveryCost = price6R;
            const liftCharge = parseFloat(sessionStorage.getItem("liftCharges")) || 0;
            const totalDelivery = deliveryCost + liftCharge;

            // Update UI
            const shippingPriceEl = document.getElementById("shippingPrice");
            const shippingDescEl = document.getElementById("shippingDesc");
            const shippingPriceInfo = document.getElementById("shipping-price-info");
            if (shippingPriceEl) {
                shippingPriceEl.textContent = `SGD$ ${totalDelivery.toFixed(2)}`;
                shippingPriceEl.style.display = "block";   // show actual shipping price
                shippingPriceInfo.style.display = "block";   // show actual shipping price
            }
            if (shippingDescEl) {
                shippingDescEl.style.display = "none";    // hide placeholder
            }

            document.getElementById("shipping-price").textContent = `Charge : SGD$ ${totalDelivery.toFixed(2)}`;

            // Update session storage
            sessionStorage.setItem("Shipping", deliveryCost.toFixed(2));
            sessionStorage.setItem("deliveryCharges", deliveryCost.toFixed(2));

            // --- Recalculate totals ---
            const subTotalText = document.getElementById("subTotal")?.textContent || "0.00";
            const subtotal = parseFloat(subTotalText.replace(/[^\d.]/g, '')) || 0;

            const gstRate = typeof gst === 'number' ? gst : gst; // fallback to 9% if gst undefined
            const tax = (subtotal + totalDelivery) * gstRate;
            const total = subtotal + totalDelivery + tax;

            // Update total UI
            const taxEl = document.querySelector(".total-line-tax_price");
            if (taxEl) taxEl.textContent = `SGD$ ${tax.toFixed(2)}`;

            const totalEl = document.getElementById("total-price");
            if (totalEl) totalEl.textContent = `SGD$ ${total.toFixed(2)}`;

            const summaryToggleEl = document.getElementById("summary-toggle-total-price");
            if (summaryToggleEl) summaryToggleEl.textContent = `SGD$ ${total.toFixed(2)}`;

            // Store updated totals
            sessionStorage.setItem("Tax", tax.toFixed(2));
            sessionStorage.setItem("SubTotal", total.toFixed(2));

            // ✅ Stop further calculation since 6R overrides everything
            return true;
        }

        // Step 2: If not 6R, normal logic applies
        for (let len = Math.min(postalCode.length, 6); len >= 2; len--) {
            const prefix = postalCode.slice(0, len);
            console.log(`🔍 Checking special charges for: ${prefix}`);
            const foundSpecial = await calculateSpecialCharges(prefix);
            if (foundSpecial) {
                console.log(`✅ Special area active (prefix ${prefix})`);
                return true;
            }
        }

        const normalPrefix = postalCode.slice(0, 2);
        console.log(`🔍 Checking normal charges for area: ${normalPrefix}`);
        const normalCharges = await calculateCharges(normalPrefix);
        if (normalCharges) return true;

        return false;

    } catch (error) {
        console.error('⚠️ Processing error:', error);
        return false;
    }
}



const handlePostalInput = debounce(async function (event) {
    const postalCode = event.target.value.trim();

    const dateInput = document.querySelector("#appb9114bc45ab4c429_selected_date");
    const timeSelect = document.querySelector("#dmeta2");
    if (dateInput) dateInput.value = "";
    if (timeSelect) timeSelect.innerHTML = '<option value="">Select Event Time</option>';

    if (!postalCode) {
        if (!handlePostalInput.lastEmpty) {  // prevent duplicate reset
            console.log('🔄 Empty postal code - resetting');
            document.getElementById("free-delivery-banner").style.display = "none";
            resetShippingAndEvents(true);
            handlePostalInput.lastEmpty = true;
        }
        return;
    } else {
        handlePostalInput.lastEmpty = false;
    }

    if (!/^\d{2,6}$/.test(postalCode)) {
        console.log(`❌ Invalid postal format: ${postalCode}`);
        resetShippingAndEvents(false);
        return;
    }

    const success = await processPostalCode(postalCode);

    if (!success) {
        console.log('🔄 No charges found - resetting');
        resetShippingAndEvents(false);
    } else {
        resetShippingAndEvents(false);
    }
}, 400);



function resetShippingAndEvents(emptyPostal = false) {
    // Safely parse currency values
    const parseCurrency = (value) => {
        const numericValue = String(value || '0')
            .replace(/[^\d.-]/g, '')
            .replace(/(\..*)\./g, '$1');
        return parseFloat(numericValue) || 0;
    };

    const formatCurrency = (amount) => `SGD$ ${amount.toFixed(2)}`;

    const updateBatch = () => {
        try {
            const shippingPrice = document.getElementById("shippingPrice");
            const shippingDesc = document.getElementById("shippingDesc");
            const shippingPriceInfo = document.getElementById("shipping-price-info");
            const subtotalEl = document.getElementById("subTotal");
            const taxPriceEl = document.querySelector(".total-line-tax_price");
            const totalPriceEl = document.getElementById("total-price");
            const summaryTotalEl = document.getElementById("summary-toggle-total-price");
            const timeSelect = document.getElementById("dmeta2");

            if (emptyPostal) {
                // EMPTY POSTAL CODE → show placeholder
                if (shippingPrice) {
                    shippingPrice.textContent = "0.00";
                    shippingPrice.style.display = "none";
                }
                if (shippingPriceInfo) shippingPriceInfo.style.display = "none";
                if (shippingDesc) shippingDesc.style.display = "block";
                document.getElementById("shipping-methods-placeholder").style.display = "block";

            } else {
                // VALID POSTAL (API failed/reset) → show last shipping price
                document.getElementById("shipping-methods-placeholder").style.display = "none";
                if (shippingPrice) shippingPrice.style.display = "block";
                if (shippingPriceInfo) shippingPriceInfo.style.display = "block";
                if (shippingDesc) shippingDesc.style.display = "none";
            }

            // Recalculate totals
            const subtotal = parseCurrency(subtotalEl?.textContent);
            const tax = subtotal * gst;
            const total = subtotal + tax;

            if (taxPriceEl) taxPriceEl.textContent = formatCurrency(tax);
            if (totalPriceEl) totalPriceEl.textContent = formatCurrency(total);
            if (summaryTotalEl) summaryTotalEl.textContent = formatCurrency(total);

            if (timeSelect) timeSelect.innerHTML = "<option value=''>Select Event Time</option>";
        } catch (error) {
            console.error("Error in resetShippingAndEvents:", error);
        }
    };

    Promise.resolve().then(updateBatch);
}


//const handlePostalInput = debounce(async function (event) {
//    const postalCode = event.target.value.trim();

//    if (!validatePostalCode(postalCode)) {
//        return;
//    }

//    const success = await processPostalCode(postalCode);
//    if (!success && postalCode.length === 6) {
//        // Only reset if we've reached full 6 digits with no matches
//        resetShippingAndEvents();
//    }
//}, 400);



function calculateCharges(firstTwoDigits) {
    if (!/^\d{2}$/.test(firstTwoDigits)) return;

    const is6R = sessionStorage.getItem("6R") === "Yes";

    $.ajax({
        type: "GET",
        dataType: "json",
        url: `/SR/CalAreaCharges?postal=${firstTwoDigits}`,
        success: function (data) {
            try {
                const parsedData = typeof data === 'string' ? JSON.parse(data) : (data.data ? JSON.parse(data.data) : data.data || data);
                if (!parsedData?.response?.data?.length) {
                    console.error("Invalid or empty response data");
                    return;
                }

                const responseItem = parsedData.response.data[0];
                const deliveryCharges = parseFloat(responseItem.charges) || 0;

                // If 6R active, force delivery to 25
                const finalDeliveryCharge = is6R ? price6R : deliveryCharges;

                const lift = document.getElementById("isunitatliftlevel")?.value || "Y";
                const liftCharges = parseFloat(sessionStorage.getItem("liftCharges")) || 0;
                const subTotalText = document.getElementById("subTotal")?.textContent || "0.00";
                const subtotal = parseFloat(subTotalText.replace(/[^\d.]/g, '')) || 0;

                let totalDelivery = lift === "N" ? finalDeliveryCharge + liftCharges : finalDeliveryCharge;
                const tax = (subtotal + totalDelivery) * gst;
                const total = subtotal + totalDelivery + tax;

                // Update UI
                document.getElementById("shippingPrice").textContent = `SGD$ ${totalDelivery.toFixed(2)}`;
                document.getElementById("shipping-price").textContent = `Charge : SGD$ ${totalDelivery.toFixed(2)}`;
                document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
                document.getElementById("total-price").textContent = `SGD$ ${total.toFixed(2)}`;
                document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;

                // Update sessionStorage
                sessionStorage.setItem("Shipping", finalDeliveryCharge.toFixed(2));
                sessionStorage.setItem("Tax", tax.toFixed(2));
                sessionStorage.setItem("SubTotal", total.toFixed(2));

                const normalAreaInfo = {
                    charges: deliveryCharges,
                    productID: responseItem.chargedProduct,
                    uomId: responseItem.uOM,
                    uom_Identifier: responseItem.uOM$_identifier,
                    product_desc: responseItem.chargedProduct
                }
                sessionStorage.setItem("normalAreaInfo", JSON.stringify(normalAreaInfo));

            } catch (err) {
                console.error("Error processing normal charges:", err);
            }
        },
        error: function (xhr, status, error) {
            console.error("Charge calculation failed:", error);
        }
    });
}

// calculateSpecialCharges remains the same as your original version


function calculateFreeCharges() {
    document.querySelectorAll("input[name='shipping_handle']").forEach(input => {
        // Set the data-price attribute to 0.00
        input.setAttribute("data-price", "0.00");
        $(input).removeData("price");  // <-- clear old cache

        // Find the closest small tag in the same shipping option block and update its text
        const priceLabel = input.closest('.shipping-option-item')?.querySelector("p.mb-0 small");
        if (priceLabel) {
            priceLabel.textContent = "SGD$ 0.00";
        }
    });
    const cartPriceAmount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];
    const lift = document.getElementById("isunitatliftlevel").value;
    const liftCharges = parseFloat(sessionStorage.getItem("liftCharges")) || 0;

    // Get subtotal
    let subTotalText = document.getElementById("subTotal").textContent.trim();
    let subtotal = parseFloat(subTotalText.replace(/[^\d.]/g, ''));

    let deliveryCharges = 0;
    let discountAmount = 0;
    let disPercent = 0;
    sessionStorage.setItem("freeDeliveryPromo", deliveryCharges);
    sessionStorage.setItem("deliveryCharges", deliveryCharges);
    // ✅ override all displayed price texts (UI only)


    // Show shipping sections
    document.getElementById("shipping-methods-content").style.display = "block";
    document.getElementById("shipping-price-info").style.display = "block";
    document.getElementById("shipping-methods-placeholder").style.display = "none";
    document.getElementById("shippingDesc").style.display = "none";
    document.getElementById("shippingPrice").style.display = "block";

    // If discount exists
    if (cartPriceAmount.length > 0) {
        discountAmount = parseFloat(cartPriceAmount[0].discountAmt);
        disPercent = cartPriceAmount[0].discountPercentage;
        subtotal = parseFloat(cartPriceAmount[0].disSubTotal);

        // Apply lift charges if needed
        if (lift === "N") {
            deliveryCharges = deliveryCharges;
        }

        // Apply discount to delivery charges
        if (disPercent) {
            discountAmount += deliveryCharges * disPercent;
            deliveryCharges = deliveryCharges * (1 - disPercent);
            cartPriceAmount[0].discountAmt = discountAmount;

            // Update localStorage
            localStorage.setItem("cartDiscountAmount", JSON.stringify(cartPriceAmount));
        }
    } else {
        // No discount available
        if (lift === "N") {
            deliveryCharges += deliveryCharges;
        }
    }

    // Calculate tax and total
    const tax = (subtotal + deliveryCharges) * gst;
    const total = subtotal + deliveryCharges + tax;

    // Update UI
    document.getElementById("shippingPrice").textContent = `SGD$ ${deliveryCharges.toFixed(2)}`;
    document.getElementById("shipping-price").textContent = `Charge : SGD$ ${deliveryCharges.toFixed(2)}`;
    document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
    document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
    document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;

    // Store in session
    sessionStorage.setItem("Tax", tax.toFixed(2));
    sessionStorage.setItem("Shipping", deliveryCharges.toFixed(2));
    sessionStorage.setItem("SubTotal", total.toFixed(2)); // Final total
}



// Function to calculate charges based on the last two digits of the postal code
//function calculateCharges(lastTwoDigits) {
//    $.ajax({
//        type: "GET",
//        dataType: "json",
//        url: `/SR/CalAreaCharges?postal=${lastTwoDigits}`,
//        success: function (data) {
//            const parsedData = data.data ? JSON.parse(data.data) : data;
//            const cartPriceAmount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];
//            console.log("calculateCharges:", data);
//            const count = parsedData.response.data.length;
//            const deliveryArea = parsedData.response.data[0].deliveryZone;
//            let deliveryCharges = parseFloat(parsedData.response.data[0].charges).toFixed(2);
//            const lift = document.getElementById("isunitatliftlevel").value;

//            if(count > 0) {
//                document.getElementById("applyVoucher").disabled = false;
//            }

//            if (deliveryCharges) {
//                sessionStorage.setItem("deliveryCharges", deliveryCharges);
//            }

//            let subtotal = parseFloat(sessionStorage.getItem("currentSubtotal")).toFixed(2);
//            let tax = 0;

//            console.log("deliveryArea", deliveryArea);

//            // Show shipping methods and prices
//            document.getElementById("shipping-methods-content").style.display = "block";
//            document.getElementById("shipping-price-info").style.display = "block";
//            document.getElementById("shipping-methods-placeholder").style.display = "none";
//            document.getElementById("shipping-price").textContent = `Charge : SGD$ ${deliveryCharges}`;
//            document.getElementById("shippingDesc").style.display = "none";
//            document.getElementById("shippingPrice").style.display = "block";
//            document.getElementById("shippingPrice").textContent = `SGD$ ${deliveryCharges}`;
//            let liftCharges = parseFloat(sessionStorage.getItem("liftCharges"));

//            // Apply discount if available
//            if (cartPriceAmount!='') {
//                let discountAmount = parseFloat(cartPriceAmount[0].discountAmt);

//                let disPercent = cartPriceAmount[0].discountPercentage;
//                subtotal = cartPriceAmount[0].disSubTotal;

//                if (lift === "N") {
//                    if (liftCharges) {
//                        deliveryCharges = parseFloat(deliveryCharges) + parseFloat(liftCharges);
//                        discountAmount += (parseFloat(deliveryCharges) * disPercent);
//                        cartPriceAmount[0].discountAmt = discountAmount;
//                        console.log("disAmt", discountAmount)

//                        localStorage.setItem("cartDiscountAmount", JSON.stringify(discountAmount));

//                        deliveryCharges = deliveryCharges - (parseFloat(deliveryCharges) * disPercent);
//                        console.log("deliveryCharges1", deliveryCharges);

//                    } else {
//                        discountAmount = (parseFloat(deliveryCharges) * disPercent);
//                        cartPriceAmount[0].discountAmt = discountAmount;
//                        console.log("disAmt", discountAmount)

//                        localStorage.setItem("cartDiscountAmount", JSON.stringify(discountAmount));
//                        deliveryCharges = parseFloat(deliveryCharges) - (parseFloat(deliveryCharges) * disPercent);
//                        console.log("deliveryCharges2", deliveryCharges);
//                    }
//                    document.getElementById("shippingPrice").textContent = `SGD$ ${deliveryCharges.toFixed(2)}`;
//                    document.getElementById("shipping-price").textContent = `Charge : SGD$ ${deliveryCharges.toFixed(2)}`;
//                    tax = (parseFloat(subtotal) + parseFloat(deliveryCharges)) * gst;
//                    total = parseFloat(subtotal) + parseFloat(deliveryCharges) + parseFloat(tax);
//                    document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//                    document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
//                    document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;
//                    sessionStorage.setItem("Tax", parseFloat(tax).toFixed(2));
//                    sessionStorage.setItem("Shipping", parseFloat(deliveryCharges).toFixed(2));
//                    sessionStorage.setItem("SubTotal", parseFloat(total));
//                }
//                else {
//                    discountAmount += (parseFloat(deliveryCharges) * disPercent);
//                    cartPriceAmount[0].discountAmt = discountAmount;
//                    console.log("disAmt", discountAmount)
//                    localStorage.setItem("cartDiscountAmount", JSON.stringify(discountAmount));
//                    deliveryCharges = parseFloat(deliveryCharges) - (parseFloat(deliveryCharges) * disPercent);
//                    document.getElementById("shippingPrice").textContent = `SGD$ ${deliveryCharges.toFixed(2)}`;
//                    document.getElementById("shipping-price").textContent = `Charge : SGD$ ${deliveryCharges.toFixed(2)}`;
//                    tax = (parseFloat(subtotal) + parseFloat(deliveryCharges)) * gst;
//                    total = parseFloat(subtotal) + parseFloat(deliveryCharges) + parseFloat(tax);
//                    document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//                    document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
//                    document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;
//                    sessionStorage.setItem("Tax", parseFloat(tax).toFixed(2));
//                    sessionStorage.setItem("Shipping", parseFloat(deliveryCharges).toFixed(2));
//                    sessionStorage.setItem("SubTotal", parseFloat(total));
//                }

//            }
//            else {
//                // Calculate total with tax
//                if (lift === "N") {
//                    if (liftCharges) {
//                        deliveryCharges = (parseFloat(deliveryCharges) + parseFloat(liftCharges));
//                        console.log("deliveryCharges3", deliveryCharges);

//                    } else {
//                        deliveryCharges = parseFloat(deliveryCharges) - (parseFloat(deliveryCharges));
//                        console.log("deliveryCharges4", deliveryCharges);
//                    }
//                    document.getElementById("shippingPrice").textContent = `SGD$ ${deliveryCharges.toFixed(2)}`;
//                    tax = (parseFloat(subtotal) + parseFloat(deliveryCharges)) * gst;
//                    let total = parseFloat(subtotal) + parseFloat(deliveryCharges) + parseFloat(tax);
//                    document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//                    document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
//                    document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;

//                    sessionStorage.setItem("Tax", parseFloat(tax));
//                    sessionStorage.setItem("Shipping", parseFloat(deliveryCharges));
//                    sessionStorage.setItem("SubTotal", parseFloat(total));
//                } else {
//                    tax = (parseFloat(subtotal) + parseFloat(deliveryCharges)) * gst;
//                    let total = parseFloat(subtotal) + parseFloat(deliveryCharges) + parseFloat(tax);
//                    document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//                    document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
//                    document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;

//                    sessionStorage.setItem("Tax", parseFloat(tax));
//                    sessionStorage.setItem("Shipping", parseFloat(deliveryCharges));
//                    sessionStorage.setItem("SubTotal", parseFloat(total));
//                }
//            }
//        }
//    });
//}





//function calLiftChargeFee2() {
//    // Retrieve discount and related information from localStorage
//    const cartPriceAmount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];
//    const discount = cartPriceAmount[0]?.discountCode || '';
//    let disPercent = cartPriceAmount[0]?.discountPercentage || 0;
//    let disSubTotal = cartPriceAmount[0]?.disSubTotal || 0;

//    // Retrieve the lift option from the UI and other related values
//    const lift = document.getElementById("isunitatliftlevel").value;
//    let subTotal = parseFloat(sessionStorage.getItem("currentSubtotal"))|| 0;
//    let deliveryCharges = parseFloat(sessionStorage.getItem("deliveryCharges")) || 0;

//    // If lift is "N", calculate the lift charge and update totals

//    if (lift === "N") {
//        const selectedLift = JSON.parse(document.getElementById("floorlevelcharges").value);
//        let liftCharge = parseFloat(selectedLift.cost) || 0;


//        if (discount) {
//                cartPriceAmount[0].discountAmt = (liftCharge * disPercent) + (deliveryCharges * disPercent);
//                // Adjust delivery charges with the discount percentage
//                let discountedLiftCharge = liftCharge - (liftCharge * disPercent);
//                deliveryCharges = deliveryCharges - (deliveryCharges * disPercent);
//                deliveryCharges += discountedLiftCharge;
//                console.log("discountedLiftCharge", discountedLiftCharge);
//                console.log("deliveryCharges", deliveryCharges);

//                // Update the shipping price with the discounted amount
//                $('#shippingPrice').text(`SGD$ ${deliveryCharges.toFixed(2)}`);

//                // Recalculate tax and total with the discounted delivery charges
//                let tax = (parseFloat(disSubTotal) + deliveryCharges) * gst;
//                let total = parseFloat(disSubTotal) + deliveryCharges + tax;
//                sessionStorage.setItem("SubTotal", total.toFixed(2));
//                sessionStorage.setItem("Tax", tax.toFixed(2));
//                // Update tax and total UI elements with the discount applied
//                document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//                document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
//                document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;
//        }
//        else {
//            // Add lift charge to delivery charges
//            deliveryCharges += liftCharge;
//            $('#shippingPrice').text(`SGD$ ${deliveryCharges.toFixed(2)}`);

//            // Recalculate tax and total (without discount)
//            tax = (parseFloat(subTotal) + parseFloat(deliveryCharges)) * gst;
//            total = parseFloat(subTotal) + parseFloat(deliveryCharges) + tax;
//            sessionStorage.setItem("SubTotal", total.toFixed(2));
//            sessionStorage.setItem("Tax", tax.toFixed(2));

//            console.log("subTotal", subTotal.toFixed(2));
//            console.log("tax", tax.toFixed(2));
//            console.log("total", total.toFixed(2));
//            // Update tax and total UI elements
//            document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//            document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
//            document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;
//            // Apply discount if available
//        }
//        sessionStorage.setItem("liftCharges", liftCharge.toFixed(2));
//    }
//    else {
//        // Add lift charge to delivery charges
//        if (discount) {
//            deliveryCharges = deliveryCharges - (deliveryCharges * disPercent);
//            // Update the shipping price with the discounted amount
//            $('#shippingPrice').text(`SGD$ ${deliveryCharges.toFixed(2)}`);
//            // Recalculate tax and total with the discounted delivery charges
//            let tax = (parseFloat(disSubTotal) + deliveryCharges) * gst;
//            let total = parseFloat(disSubTotal) + deliveryCharges + tax;
//            sessionStorage.setItem("SubTotal", total.toFixed(2));
//            sessionStorage.setItem("Tax", tax.toFixed(2));
//            // Update tax and total UI elements with the discount applied
//            document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//            document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
//            document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;
//        }
//        else {
//            $('#shippingPrice').text(`SGD$ ${deliveryCharges.toFixed(2)}`);
//            // Recalculate tax and total (without discount)
//            tax = (parseFloat(subTotal) + parseFloat(deliveryCharges)) * gst;
//            total = parseFloat(subTotal) + parseFloat(deliveryCharges) + tax;
//            sessionStorage.setItem("SubTotal", total.toFixed(2));
//            sessionStorage.setItem("Tax", tax.toFixed(2));
//            console.log("subTotal", subTotal);
//            console.log("tax", tax);
//            console.log("total", total);
//            // Update tax and total UI elements
//            document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//            document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
//            document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;
//        }
//        sessionStorage.setItem("liftCharges", 0);
//    }
//}


function calLiftChargeFee() {
    const cartPriceAmount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];
    const discount = cartPriceAmount[0]?.discountCode || '';
    let disPercent = parseFloat(cartPriceAmount[0]?.discountPercentage || 0);
    if (disPercent > 1) disPercent = disPercent / 100;
    const disSubTotal = parseFloat(cartPriceAmount[0]?.disSubTotal || 0);

    const lift = document.getElementById("isunitatliftlevel").value; // "Y" or "N"
    const subTotal = parseFloat(document.getElementById("subTotal").innerText.replace(/[^\d.]/g, '')) || 0;

    // Base delivery (postal code)
    const baseDelivery = parseFloat(sessionStorage.getItem("deliveryCharges")) || 0;
    const freeDeliveryPromo = sessionStorage.getItem("freeDeliveryPromo");

    // Time slot charge
    let timeSlotCharge = 0;
    try {
        const deliverySelect = document.getElementById("dmeta2");
        if (deliverySelect && deliverySelect.value) {
            const selectedDelivery = JSON.parse(deliverySelect.value);
            timeSlotCharge = parseFloat(selectedDelivery.cost) || 0;
        }
    } catch (err) {
        console.warn("Failed to parse delivery time slot", err);
    }

    // Lift charge
    let liftCharge = 0;
    if (lift === "N") {
        try {
            const floorChargesInput = document.getElementById("floorlevelcharges");
            if (floorChargesInput && floorChargesInput.value) {
                const selectedLift = JSON.parse(floorChargesInput.value);
                liftCharge = parseFloat(selectedLift.cost) || 0;
            }
        } catch (err) {
            console.warn("Failed to parse floor level charges", err);
        }

        // Free delivery promo overrides lift charge
        if (freeDeliveryPromo != null && freeDeliveryPromo !== "null") {
            const promoVal = parseFloat(freeDeliveryPromo);
            if (!isNaN(promoVal)) liftCharge = promoVal;
        }
    }

    // Calculate final shipping
    let shipping = 0;
    if (timeSlotCharge > 0) {
        shipping = timeSlotCharge + liftCharge;   // time slot selected
    } else {
        shipping = baseDelivery + liftCharge;     // no time slot
    }

    // Apply discount if any
    if (discount) {
        const discountAmt = shipping * disPercent;
        cartPriceAmount[0].discountAmt = discountAmt;
        localStorage.setItem("cartDiscountAmount", JSON.stringify(cartPriceAmount));
        shipping -= discountAmt;
    }

    // Update UI
    $('#shippingPrice').text(`SGD$ ${shipping.toFixed(2)}`);
    $('#shipping-price').text(`Charge : SGD$ ${shipping.toFixed(2)}`);
    sessionStorage.setItem("liftCharges", liftCharge.toFixed(2));

    // Calculate total
    const taxableBase = (discount ? disSubTotal : subTotal) + shipping;
    const tax = taxableBase * gst;
    const total = taxableBase + tax;

    sessionStorage.setItem("SubTotal", total.toFixed(2));
    sessionStorage.setItem("Tax", tax.toFixed(2));

    document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
    document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
    document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;

    // Debug logs
    console.log("Base delivery:", baseDelivery);
    console.log("Time slot charge:", timeSlotCharge);
    console.log("Lift charge:", liftCharge);
    console.log("Shipping after discount:", shipping);
    console.log("Tax:", tax.toFixed(2));
    console.log("Total:", total.toFixed(2));
}
// ========== 🕒 Time Utility Functions ==========
function addHoursToTimeString(timeStr, hoursToAdd) {
    if (typeof timeStr !== 'string') {
        console.warn('Skipping invalid timeStr:', timeStr);
        return null; // or return some default value
    }
    const [h, m, s = 0] = timeStr.split(':').map(Number);
    let newHour = (h + hoursToAdd) % 24;
    if (newHour < 0) newHour += 24;
    return `${String(newHour).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}



function timeToMinutes(timeStr) {
    const [time, modifier] = timeStr.trim().split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
}
function extractMinutesFromEventTime(eventTime) {
    const parts = eventTime.split('-');
    const start = parts[0].replace('☀️', '').trim();
    const end = parts[1].replace('☀️', '').trim();
    return [timeToMinutes(start), timeToMinutes(end)];
}

function formatMinutesTo12h(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
}

function minutesToTimeStr(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function convertUtcToLocal(timeStr, offsetHours) {
    const totalMinutes = timeToMinutes(timeStr);
    const localMinutes = (totalMinutes + offsetHours * 60) % (24 * 60);
    return minutesToTimeStr(localMinutes);
}

function formatYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function addFutureSundaysToBlockedDates(numWeeks = 154) {
    const today = new Date();
    const blockedSet = new Set(blockedDates);

    for (let i = 0; i < numWeeks; i++) {
        const nextSunday = new Date(today);
        nextSunday.setDate(today.getDate() + ((7 - today.getDay()) % 7) + i * 7);
        const nextSundayYMD = formatYMD(nextSunday);

        // Unblock if public holiday with charges
        const isHolidayWithCharge = publicHolidayCache.some(h =>
            formatYMD(new Date(h.date)) === nextSundayYMD && h.charges > 0
        );

        if (!isHolidayWithCharge) {
            blockedSet.add(nextSundayYMD);
        } else {
            console.log(`✅ Unblocking Sunday due to holiday with charge: ${nextSundayYMD}`);
        }
    }

    blockedDates = Array.from(blockedSet);
    //console.log("✅ Updated blockedDates with Sundays (considering holidays):", blockedDates);
}


function fetchBlockedDatesFromApi(callback) {
    $.ajax({
        type: "GET",
        url: "/SR/GetCalendarBlock",
        dataType: "text",
        success: function (response) {
            let json;
            try {
                json = JSON.parse(response);
            } catch (err) {
                blockedDates = [];
                blockedPickUpDates = [];
                return callback && callback();
            }

            const ranges = json?.response?.data;
            blockedDates = [];
            blockedPickUpDates = [];

            if (Array.isArray(ranges)) {
                ranges.forEach(item => {
                    const start = new Date(item.deliveryDate);
                    const end = new Date(item.deliveryDateEnd);
                    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                        return;
                    }

                    const desc = (item.description || "").toLowerCase();

                    let current = new Date(start);
                    while (current <= end) {
                        const dateStr = formatYMD(current);

                        if (desc.includes("pick up")) {
                            blockedPickUpDates.push(dateStr);
                        } else if (desc.includes("delivery")) {
                            blockedDates.push(dateStr);
                        }

                        current.setDate(current.getDate() + 1);
                    }
                });
            }

            // Sundays only apply to delivery
            addFutureSundaysToBlockedDates(154);

            if (callback) callback();
        }
    });
}

async function handleDateChange() {
    const dateInput = document.getElementById('appb9114bc45ab4c429_selected_date');
    const container = document.getElementById('appb9114bc45ab4c429_datetimepicker');
    const rawValue = dateInput.value.trim();
    const allEventTimes = JSON.parse(sessionStorage.getItem("eventTimes") || "[]");
    const dmeta2 = document.getElementById("dmeta2");
    if (dmeta2) dmeta2.innerHTML = '';

    let parsedDate = null;
    if (rawValue.includes('/')) {
        const [dd, mm, yyyy] = rawValue.split('/');
        parsedDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
    } else {
        parsedDate = new Date(rawValue);
    }

    if (isNaN(parsedDate)) {
        console.warn("Invalid date input:", rawValue);
        return;
    }

    const formattedDate = formatYMD(parsedDate);
    dateInput.value = formattedDate;

    // ✅ Check free delivery first
    const hasFreeDelivery = await callFreeDeliveryApi(formattedDate);
    if (hasFreeDelivery) {
        console.log("🚚 Free delivery detected — skipping overrides.");
        return;
    }

    const dayName = parsedDate.toLocaleDateString('en-SG', { weekday: 'long' });
    const todayStr = formatYMD(new Date());
    const isToday = formattedDate === todayStr;
    console.log("📅 Selected Day:", dayName);
    console.log("📌 Is today selected?", isToday);

    if (isToday) {
        sessionStorage.setItem("isToday", isToday);
    } else {
        sessionStorage.removeItem("isToday");
    }

    // ✅ Call holiday API — returns deliveryInfo object or null
    const holidayInfo = await callPublicHolidayDeliveryApi(formattedDate);
    const hasHoliday = !!holidayInfo;
    const holidayCharge = hasHoliday ? parseFloat(holidayInfo.charges ?? 0) : null;

    // ✅ If free holiday delivery, calculateFreeCharges already ran — stop here
    if (hasHoliday && holidayCharge === 0) {
        console.log("🎉 Free holiday delivery — skipping charge overrides.");

        // Still filter event times to show holiday slots only
        const holidayEventTimes = allEventTimes.filter(et =>
            et.description && et.description.toLowerCase().includes("holiday")
        );
        console.log("Holiday event times:", holidayEventTimes);

        // Render with $0 charge for all slots
        const freeSlots = holidayEventTimes.map(et => ({
            ...et,
            charge: 0,
            deliveryCost: 0,
            chargeSource: "Holiday Free Delivery"
        }));

        console.log("🎯 Final filtered event times:", freeSlots);
        renderEventOptions(freeSlots);
        return; // 🛑 Stop — do not let Strict Priority Logic overwrite
    }

    // ✅ FILTER EVENT TIMES based on holiday status
    let eventTimesToProcess = allEventTimes;

    if (hasHoliday) {
        console.log("🎉 Holiday detected - filtering for holiday time slots");
        eventTimesToProcess = allEventTimes.filter(et =>
            et.description && et.description.toLowerCase().includes("holiday")
        );
        console.log("Holiday event times:", eventTimesToProcess);
    } else {
        console.log("📅 Normal day - filtering out holiday time slots");
        eventTimesToProcess = allEventTimes.filter(et =>
            !et.description || !et.description.toLowerCase().includes("holiday")
        );
        console.log("Normal day event times:", eventTimesToProcess);
    }

    // ✅ Get applicable charges
    let applicableCharges = [];
    const safeCache = (Array.isArray(dayChargesCache)) ? dayChargesCache : [];

    if (hasHoliday) {
        // ✅ Use the priced holiday charge from the API directly
        applicableCharges = [{
            ...holidayInfo,
            charges: holidayCharge,
            startDay: dayName,
            endDay: dayName,
            isSameDayDelivery: false
        }];
        console.log("✅ Using priced holiday charge from API:", applicableCharges);
    } else if (isToday) {
        applicableCharges = safeCache.filter(item =>
            isDayInRange(dayName, item.startDay, item.endDay) &&
            item.isSameDayDelivery === true
        );
    } else {
        applicableCharges = safeCache.filter(item =>
            isDayInRange(dayName, item.startDay, item.endDay) &&
            !item.isSameDayDelivery &&
            !(item.description && item.description.toLowerCase().includes("holiday"))
        );
    }

    console.log("📌 Final applicableCharges:", applicableCharges);

    sessionStorage.setItem("applicableDayCharges", JSON.stringify(applicableCharges));

    const filteredEventTimes = filterEventTimesByCharges(eventTimesToProcess, applicableCharges, dayName);

    console.log("🎯 Final filtered event times:", filteredEventTimes);
    renderEventOptions(filteredEventTimes);
}


// ========== 🚚 Free Delivery Promo API ==========
async function callFreeDeliveryApi(dateValue) {
    try {
        const apiUrl = `/SR/FreeAreaCharges?date=${encodeURIComponent(dateValue)}`;
        console.log(`[API] Calling: ${apiUrl}`);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Status ${response.status}`);
        }

        let data = await response.json();
        // Handle case where API sends JSON string instead of object
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (err) {
                console.error("❌ Failed to parse string response:", err);
                return false;
            }
        }
        const deliveryInfo = data?.response?.data?.[0];
        if (deliveryInfo) {
            const promoCharge = parseFloat(deliveryInfo.charges ?? 0);

            if (promoCharge === 0) {
                // Truly free delivery
                updateDeliveryBanner({
                    isFreeDelivery: true,
                    message: deliveryInfo.description,
                    validUntil: deliveryInfo.deliveryDate?.split('T')[0] || ''
                });
                calculateFreeCharges();
                return true; // stop here for free delivery
            } else {
                // ✅ Priced Specific Day Charge (e.g. $10 promo)
                sessionStorage.setItem("specificDayInfo", JSON.stringify(deliveryInfo));
                console.log("🎯 Specific Day Charge found: $" + promoCharge);
                updateDeliveryBanner({
                    isFreeDelivery: false,
                    message: deliveryInfo.description || '$10 Delivery Promo',
                });
                return false; // ✅ continue to filterEventTimesByCharges
            }
        } else {
            sessionStorage.removeItem("specificDayInfo"); // ✅ clear on no match
            sessionStorage.setItem("freeDeliveryPromo", null);
            updateDeliveryBanner({ isFreeDelivery: false });
            return false;
        }
    } catch (error) {
        console.error('API Error:', error);
        updateDeliveryBanner({ error: 'Failed to check delivery status' });
        return false;
    }
}


async function callPublicHolidayDeliveryApi(dateValue) {
    try {
        const apiUrl = `/SR/PublicHolidayAreaCharges?date=${encodeURIComponent(dateValue)}`;
        const response = await fetch(apiUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error(`Status ${response.status}`);
        let data = await response.json();
        if (typeof data === 'string') data = JSON.parse(data);
        const deliveryInfo = data?.response?.data?.[0];
        if (deliveryInfo) {
            const promoCharge = parseFloat(deliveryInfo.charges ?? 0);
            if (promoCharge === 0) {
                sessionStorage.removeItem("specificDayInfo");
                updateDeliveryBanner({ isFreeDelivery: true, message: deliveryInfo.description });
                calculateFreeCharges();
                return deliveryInfo; // ✅ Return object instead of true
            } else {
                sessionStorage.setItem("specificDayInfo", JSON.stringify(deliveryInfo));
                console.log("🎯 Specific Day Charge found: $" + promoCharge);
                updateDeliveryBanner({ isFreeDelivery: false, message: deliveryInfo.description || 'Delivery promo applies.' });
                return deliveryInfo; // ✅ Return object instead of false
            }
        } else {
            sessionStorage.removeItem("specificDayInfo");
            sessionStorage.setItem("freeDeliveryPromo", null);
            updateDeliveryBanner({ isFreeDelivery: false });
            return null; // ✅ Return null when no holiday found
        }
    } catch (error) {
        console.error('API Error:', error);
        updateDeliveryBanner({ error: 'Failed to check delivery status' });
        return null;
    }
}


function updateDeliveryBanner({ isFreeDelivery, message, validUntil, error }) {
    let banner = document.getElementById('free-delivery-banner');
    const container = document.getElementById('appb9114bc45ab4c429_datetimepicker');

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'free-delivery-banner';
        banner.style.marginTop = '10px';
        banner.style.padding = '10px';
        banner.style.borderRadius = '4px';

        if (container && container.parentNode) {
            container.parentNode.insertBefore(banner, container.nextSibling);
        } else {
            document.body.appendChild(banner);
        }
    }

    // ✅ If postal code is 6R, force delivery charge $25
    const is6R = sessionStorage.getItem("6R") === "Yes";
    if (is6R && message) {
        const specificChargeText = `${message}`;
        // Update banner
        banner.innerHTML = `
        ⚠️<strong>Delivery Charges Apply</strong>
        <p>${message}</p>
    `;
        banner.style.backgroundColor = '#fff4e5';
        banner.style.color = '#a66300';
        banner.style.display = 'block';

        // Update shipping UI
        const shippingDesc = document.getElementById('shippingDesc');
        const shippingPrice = document.getElementById('shippingPrice');

        if (shippingDesc) {
            shippingDesc.style.display = 'block';
            shippingDesc.textContent = specificChargeText;
        }
        if (shippingPrice) {
            shippingPrice.style.display = 'block';
            shippingPrice.textContent = 'SGD$ 25.00';
        }

        return; // skip free-delivery logic
    }



    if (error) {
        banner.innerHTML = `⚠️ ${error}`;
        banner.style.backgroundColor = '#ffebee';
        banner.style.color = '#c62828';
        banner.style.display = 'block';
        return;
    }

    if (isFreeDelivery) {
        banner.innerHTML = `
            ✅ <strong>Free Delivery Available!</strong>
            ${message ? `<p>${message}</p>` : ''}
            ${validUntil ? `<small>Valid until: ${validUntil}</small>` : ''}
        `;
        banner.style.backgroundColor = '#e6ffed';
        banner.style.color = '#1f6f3d';
        banner.style.display = 'block';

        // Update shipping UI for free delivery
        const shippingDesc = document.getElementById('shippingDesc');
        const shippingPrice = document.getElementById('shippingPrice');
        if (shippingDesc) shippingDesc.style.display = 'none';
        if (shippingPrice) {
            shippingPrice.style.display = 'block';
            shippingPrice.textContent = 'SGD$ 0.00';
        }

    } else if (message) {
        banner.innerHTML = `
            ⚠️ <strong>Delivery Charges Apply</strong>
            ${message ? `<p>${message}</p>` : ''}
        `;
        banner.style.backgroundColor = '#fff4e5';
        banner.style.color = '#a66300';
        banner.style.display = 'block';
    } else {
        banner.style.display = 'none';
    }
}


// Filter events that fit entirely within any applicable charge time window
function timeStringToMinutes(timeStr, offsetHours = 0) {
    if (!timeStr) return 0;

    // Remove emojis & non-time chars
    let clean = timeStr.replace(/[^\d:APMapm ]/g, '').trim();

    let hours = 0, minutes = 0;
    const isPM = /PM/i.test(clean);
    const isAM = /AM/i.test(clean);

    // Extract "HH:MM"
    const match = clean.match(/(\d{1,2}):(\d{2})/);
    if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);

        if (isPM && hours < 12) hours += 12;
        if (isAM && hours === 12) hours = 0;
    }

    return hours * 60 + minutes + offsetHours * 60;
}

function extractMinutesFromEventTime(eventTimeStr) {
    if (!eventTimeStr) return [0, 0];

    const [startStr, endStr] = eventTimeStr.split('-').map(s => s.trim());
    return [
        timeStringToMinutes(startStr),
        timeStringToMinutes(endStr)
    ];
}
function parse12HourTime(str) {
    if (!str) return null;

    // Remove emoji and extra spaces
    str = str.replace(/[^\d:AMPamp\s]/g, "").trim();

    // Use Date to safely parse 12-hour time
    const d = new Date("1970-01-01 " + str);
    if (isNaN(d)) {
        console.warn("⚠️ Failed to parse time:", str);
        return null;
    }
    return d.getHours() * 60 + d.getMinutes();
}

//function extractMinutesFromEventTime(eventTimeStr) {
//    if (!eventTimeStr) {
//        console.warn("⚠️ extractMinutesFromEventTime received undefined:", eventTimeStr);
//        return [0, 0];
//    }

//    // Split at dash
//    const [startStr, endStr] = eventTimeStr.split('-').map(s => s.trim());

//    return [
//        parse12HourTime(startStr) || 0,
//        parse12HourTime(endStr) || 0
//    ];
//}

function timeStringToMinutesWithOffset(timeStr, offsetHours = 0) {
    const [h, m, s = 0] = timeStr.split(':').map(Number);
    let totalMinutes = h * 60 + m + offsetHours * 60;
    // Wrap around 24 hours
    totalMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    return totalMinutes;
}


function filterEventTimesByCharges(eventSessions, applicableCharges, dayName) {
    const OFFSET_HOURS = 8;
    const matchingEventTimes = [];

    // 1. Filter out pickup time slots
    const shippingEventSessions = eventSessions.filter(session => {
        const desc = (session.description || '').toLowerCase();
        return !desc.includes('pickup') && !desc.includes('collection') && !desc.includes('pick up');
    });

    console.log("Filtered shipping sessions (excluding pickup):", shippingEventSessions);

    const specialArea = sessionStorage.getItem("specialAreaInfo");
    const normalArea = sessionStorage.getItem("normalAreaInfo");
    const publicHolidayInfo = sessionStorage.getItem("publicHolidayInfo");

    // --- PRIORITY 0: Specific Day Date-Range Promo (e.g. $10 Apr 20-24) ---
    // Only set by callFreeDeliveryApi when API confirms this exact date has a promo
    const specificDayInfo = sessionStorage.getItem("specificDayInfo");
    if (specificDayInfo) {
        const specificDay = JSON.parse(specificDayInfo);
        const specificCharge = parseFloat(specificDay.charges);
        console.log("🎯 Priority 0: Specific Day Charge ->", specificCharge);

        for (const session of shippingEventSessions) {
            const [eStart, eEnd] = extractMinutesFromEventTime(session.eventTime);
            matchingEventTimes.push({
                eventTime: session.eventTime,
                startMin: eStart,
                endMin: eEnd,
                charge: specificCharge,
                deliveryCost: specificCharge,
                chargeSource: "Specific Day"
            });
        }
        return sortAndRender(matchingEventTimes);
    }

    // --- PRIORITY 1: Same-Day Delivery ---
    const sameDayCharges = applicableCharges.filter(c => c.isSameDayDelivery === true);
    if (sameDayCharges.length > 0) {
        console.log("⚡ Priority 1: Same-day delivery check");
        for (const charge of sameDayCharges) {
            if (!charge.startingTime || !charge.endingTime) continue;
            const chargeStartMin = timeStringToMinutesWithOffset(charge.startingTime, OFFSET_HOURS);
            for (const session of shippingEventSessions) {
                const sessionStartMin = timeStringToMinutesWithOffset(session.startingTime, OFFSET_HOURS);
                const [eventStartMin, eventEndMin] = extractMinutesFromEventTime(session.eventTime);
                if (sessionStartMin === chargeStartMin) {
                    if (!matchingEventTimes.some(mt => mt.eventTime === session.eventTime)) {
                        matchingEventTimes.push({
                            eventTime: session.eventTime,
                            startMin: eventStartMin,
                            endMin: eventEndMin,
                            charge: charge.charges,
                            deliveryCost: charge.charges
                        });
                    }
                }
            }
        }
        return sortAndRender(matchingEventTimes);
    }

    // --- PREPARE DATA FOR PRIORITY CHECK ---
    const sessionChargeMap = new Map();

    // Map Holiday Slots
    if (publicHolidayInfo) {
        shippingEventSessions.forEach(session => {
            if (session.description && /holiday/i.test(session.description)) {
                if (!sessionChargeMap.has(session.eventTime)) sessionChargeMap.set(session.eventTime, []);
                sessionChargeMap.get(session.eventTime).push({ charge: session.eventTimeCharges || 0, source: 'Holiday Slot' });
            }
        });
    }

    // Map Special Area
    if (specialArea) {
        const areaInfo = JSON.parse(specialArea);
        const chargeStartMin = timeStringToMinutesWithOffset(areaInfo.startingTime, OFFSET_HOURS);
        const chargeEndMin = timeStringToMinutesWithOffset(areaInfo.endingTime, OFFSET_HOURS);
        shippingEventSessions.forEach(session => {
            const [eStart, eEnd] = extractMinutesFromEventTime(session.eventTime);
            if (eStart < chargeEndMin && eEnd > chargeStartMin) {
                if (!sessionChargeMap.has(session.eventTime)) sessionChargeMap.set(session.eventTime, []);
                sessionChargeMap.get(session.eventTime).push({ charge: areaInfo.charges || 0, source: 'Special Area' });
            }
        });
    }

    // Map Normal Area
    if (normalArea) {
        const normalInfo = JSON.parse(normalArea);
        shippingEventSessions.forEach(session => {
            if (!sessionChargeMap.has(session.eventTime)) sessionChargeMap.set(session.eventTime, []);
            sessionChargeMap.get(session.eventTime).push({ charge: normalInfo.charges || 0, source: 'Normal Area' });
        });
    }

    // --- FINAL DETERMINATION ---
    console.log("💰 Determining charges with Strict Priority Logic:");

    let holidayDayOverride = null;
    if (publicHolidayInfo) {
        const hInfo = JSON.parse(publicHolidayInfo);
        if (hInfo && hInfo.charges !== undefined) {
            holidayDayOverride = parseFloat(hInfo.charges);
        }
    }

    for (const [eventTime, chargeOptions] of sessionChargeMap) {
        let finalCharge = 0;
        let selectedSource = "";

        if (holidayDayOverride !== null) {
            finalCharge = holidayDayOverride;
            selectedSource = "Holiday Day Override";
        } else {
            const holidaySlot = chargeOptions.find(o => o.source === 'Holiday Slot');
            const areaCharge = chargeOptions.find(o => o.source === 'Special Area' || o.source === 'Normal Area');

            if (holidaySlot) {
                finalCharge = holidaySlot.charge;
                selectedSource = "Holiday Slot";
            } else if (areaCharge) {
                finalCharge = areaCharge.charge;
                selectedSource = areaCharge.source;
            } else {
                const highest = chargeOptions.reduce((max, curr) => curr.charge > max.charge ? curr : max, { charge: 0 });
                finalCharge = highest.charge;
                selectedSource = highest.source || "Default";
            }
        }

        console.log(`${eventTime}: Final Selection -> ${selectedSource} ($${finalCharge})`);

        const session = shippingEventSessions.find(s => s.eventTime === eventTime);
        if (session) {
            const [eStart, eEnd] = extractMinutesFromEventTime(session.eventTime);
            matchingEventTimes.push({
                eventTime: session.eventTime,
                startMin: eStart,
                endMin: eEnd,
                charge: finalCharge,
                deliveryCost: finalCharge,
                chargeSource: selectedSource
            });
        }
    }

    return sortAndRender(matchingEventTimes);

    // --- RENDER FUNCTION ---
    function sortAndRender(events) {
        const uniqueEvents = Array.from(new Map(events.map(e => [e.eventTime, e])).values())
            .sort((a, b) => a.startMin - b.startMin);

        if (uniqueEvents.length > 0) {
            const liftCharge = parseFloat(sessionStorage.getItem("liftCharges")) || 0;
            let deliveryCost = uniqueEvents[0].deliveryCost + liftCharge;

            if (sessionStorage.getItem("6R") === "Yes") {
                deliveryCost = (typeof price6R !== 'undefined' ? price6R : 0) + liftCharge;
            }

            document.getElementById("shippingPrice").textContent = `SGD$ ${deliveryCost.toFixed(2)}`;
            document.getElementById("shipping-price").textContent = `Charge : SGD$ ${deliveryCost.toFixed(2)}`;

            const subtotal = parseFloat(document.getElementById("subTotal").textContent.replace(/[^\d.]/g, '')) || 0;
            const tax = (subtotal + deliveryCost) * gst;
            const total = subtotal + deliveryCost + tax;

            document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
            document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
            // ✅ FIX: Update mobile summary toggle
            document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;

            sessionStorage.setItem("Shipping", deliveryCost.toFixed(2));
            sessionStorage.setItem("deliveryCharges", deliveryCost.toFixed(2));
            sessionStorage.setItem("Tax", tax.toFixed(2));
            sessionStorage.setItem("SubTotal", total.toFixed(2));
        }

        return uniqueEvents;
    }
}


function isDayInRange(day, startDay, endDay) {
    const daysOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayIdx = daysOrder.indexOf(day.trim());
    const startIdx = daysOrder.indexOf(startDay?.trim());
    const endIdx = daysOrder.indexOf(endDay?.trim());

    if (dayIdx === -1 || startIdx === -1 || endIdx === -1) return false;

    return startIdx <= endIdx
        ? dayIdx >= startIdx && dayIdx <= endIdx
        : dayIdx >= startIdx || dayIdx <= endIdx;
}


//document.addEventListener('DOMContentLoaded', function () {
//    const dateInput = document.getElementById('appb9114bc45ab4c429_selected_date');
//    const container = document.getElementById('appb9114bc45ab4c429_datetimepicker');
//    const isUsingDatepicker = window.jQuery && $(dateInput).datepicker;

//    if (!dateInput || !container) {
//        return console.warn("Date input or container not found!");
//    }


//    // ========== 🗓 Date Change Handling ==========

//    //handleDateChange();




//    // ========== 🚚 Free Delivery Promo API ==========
//    async function callFreeDeliveryApi(dateValue) {
//        try {
//            const apiUrl = `/SR/FreeAreaCharges?date=${encodeURIComponent(dateValue)}`;
//            console.log(`[API] Calling: ${apiUrl}`);

//            const response = await fetch(apiUrl, {
//                method: 'GET',
//                headers: { 'Accept': 'application/json' }
//            });

//            if (!response.ok) {
//                throw new Error(`Status ${response.status}`);
//            }

//            let data = await response.json();

//            // Handle case where API sends JSON string instead of object
//            if (typeof data === 'string') {
//                try {
//                    data = JSON.parse(data);
//                } catch (err) {
//                    console.error("❌ Failed to parse string response:", err);
//                    return false;
//                }
//            }

//            const deliveryInfo = data?.response?.data?.[0];

//            if (deliveryInfo) {
//                updateDeliveryBanner({
//                    isFreeDelivery: true,
//                    message: deliveryInfo.description,
//                    validUntil: deliveryInfo.deliveryDate?.split('T')[0] || ''
//                });

//                calculateFreeCharges();
//                return true; // ✅ Stops execution in handleDateChange
//            } else {
//                sessionStorage.setItem("freeDeliveryPromo", null);
//                updateDeliveryBanner({ isFreeDelivery: false });
//                return false;
//            }
//        } catch (error) {
//            console.error('API Error:', error);
//            updateDeliveryBanner({ error: 'Failed to check delivery status' });
//            return false;
//        }
//    }


//    async function callPublicHolidayDeliveryApi(dateValue) {
//        try {
//            const apiUrl = `/SR/PublicHolidayAreaCharges?date=${encodeURIComponent(dateValue)}`;
//            const response = await fetch(apiUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
//            if (!response.ok) throw new Error(`Status ${response.status}`);

//            let data = await response.json();
//            if (typeof data === 'string') data = JSON.parse(data);

//            const deliveryInfo = data?.response?.data?.[0];
//            console.log("deliveryInfo", deliveryInfo);
//            if (deliveryInfo) {
//                console.log("Is Public Holiday with special delivery charge");

//                sessionStorage.setItem("publicHolidayInfo", JSON.stringify(deliveryInfo));

//                const chargeAmt = deliveryInfo.charges ?? 0;
//                updateDeliveryBanner({
//                    isFreeDelivery: false,
//                    message: `${deliveryInfo.description || 'Holiday delivery charge applies.'} SGD$${chargeAmt.toFixed(2)}`,
//                    validUntil: deliveryInfo.deliveryDate?.split('T')[0] || ''
//                });

//                return true; // public holiday with charge exists
//            } else {
//                console.log("Is Not a Public Holiday");
//                sessionStorage.removeItem("publicHolidayInfo");
//                sessionStorage.removeItem("isPublicHolidayAsSunday");
//                updateDeliveryBanner({ isFreeDelivery: false });
//                return false; // no holiday info
//            }
//        } catch (error) {
//            console.error('API Error:', error);
//            updateDeliveryBanner({ error: 'Failed to check delivery status' });
//            return false;
//        }
//    }

//    function updateDeliveryBanner({ isFreeDelivery, message, validUntil, error }) {
//        let banner = document.getElementById('free-delivery-banner');
//        const container = document.getElementById('appb9114bc45ab4c429_datetimepicker');

//        if (!banner) {
//            banner = document.createElement('div');
//            banner.id = 'free-delivery-banner';
//            banner.style.marginTop = '10px';
//            banner.style.padding = '10px';
//            banner.style.borderRadius = '4px';

//            if (container && container.parentNode) {
//                container.parentNode.insertBefore(banner, container.nextSibling);
//                console.log('Banner inserted after container');
//            } else {
//                document.body.appendChild(banner);
//                console.log('Banner appended to body');
//            }
//        }

//        if (error) {
//            banner.innerHTML = `⚠️ ${error}`;
//            banner.style.backgroundColor = '#ffebee';
//            banner.style.color = '#c62828';
//            banner.style.display = 'block';
//            console.log('Banner shown with error:', error);
//            return;
//        }

//        if (isFreeDelivery) {
//            banner.innerHTML = `
//            ✅ <strong>Free Delivery Available!</strong>
//            ${message ? `<p>${message}</p>` : ''}
//            ${validUntil ? `<small>Valid until: ${validUntil}</small>` : ''}
//        `;
//            banner.style.backgroundColor = '#e6ffed';
//            banner.style.color = '#1f6f3d';
//            banner.style.display = 'block';
//            console.log('Banner shown for free delivery');
//        } else if (message) {
//            banner.innerHTML = `
//            ⚠️ <strong>Delivery Charges Apply</strong>
//            ${message ? `<p>${message}</p>` : ''}
//        `;
//            banner.style.backgroundColor = '#fff4e5';
//            banner.style.color = '#a66300';
//            banner.style.display = 'block';
//            console.log('Banner shown for public holiday charge:', message);
//        } else {
//            banner.style.display = 'none';
//            console.log('Banner hidden');
//        }
//    }

//    // Filter events that fit entirely within any applicable charge time window
//    function timeStringToMinutes(t) {
//        const [time, modifier] = t.trim().split(' ');
//        let [hours, minutes] = time.split(':').map(Number);

//        if (modifier === 'PM' && hours !== 12) hours += 12;
//        if (modifier === 'AM' && hours === 12) hours = 0;

//        return hours * 60 + minutes;
//    }

//    function extractMinutesFromEventTime(eventTime) {
//        const [start, end] = eventTime.split('☀️-').map(s => s.trim().replace('☀️', '').trim());
//        return [timeStringToMinutes(start), timeStringToMinutes(end)];
//    }

//    function timeStringToMinutesWithOffset(timeStr, offsetHours = 0) {
//        const [h, m, s = 0] = timeStr.split(':').map(Number);
//        let totalMinutes = h * 60 + m + offsetHours * 60;
//        // Wrap around 24 hours
//        totalMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
//        return totalMinutes;
//    }
//    function filterEventTimesByCharges(eventSessions, applicableCharges) {
//        const OFFSET_HOURS = 8;
//        const matchingEventTimes = [];

//        const specialArea = sessionStorage.getItem("specialAreaInfo");
//        const publicHolidayInfo = sessionStorage.getItem("publicHolidayInfo");
//        const isToday = sessionStorage.getItem("isToday") === "true";

//        // Priority 1: same-day delivery charges (if any)
//        const sameDayCharges = applicableCharges.filter(c => c.isSameDayDelivery === true);
//        if (sameDayCharges.length > 0) {
//            console.log("⚡ Priority 1: Using same-day delivery charges only", sameDayCharges);

//            for (const charge of sameDayCharges) {
//                if (!charge.startingTime || !charge.endingTime) continue;

//                const chargeStartMin = timeStringToMinutesWithOffset(charge.startingTime, OFFSET_HOURS);
//                const chargeEndMin = timeStringToMinutesWithOffset(charge.endingTime, OFFSET_HOURS);

//                for (const session of eventSessions) {
//                    const [eventStartMin, eventEndMin] = extractMinutesFromEventTime(session.eventTime);

//                    if (eventStartMin === chargeStartMin && eventEndMin <= chargeEndMin) {
//                        if (!matchingEventTimes.some(mt => mt.eventTime === session.eventTime)) {
//                            matchingEventTimes.push({
//                                eventTime: session.eventTime,
//                                startMin: eventStartMin,
//                                endMin: eventEndMin,
//                                charge: charge.charges,
//                                deliveryCost: charge.charges
//                            });
//                        }
//                    }
//                }
//            }
//            return sortAndRender(matchingEventTimes);
//        }

//        // Priority 2: Public holiday → Sunday slots even if no same-day charges
//        if (publicHolidayInfo) {
//            const sundayCharges = applicableCharges.filter(c =>
//                isDayInRange("Sunday", c.startDay, c.endDay) && !c.isSameDayDelivery
//            );

//            console.log("🎉 Priority 2: Public holiday - Sunday charges", sundayCharges);

//            for (const charge of sundayCharges) {
//                if (!charge.startingTime || !charge.endingTime) continue;

//                const chargeStartMin = timeStringToMinutesWithOffset(charge.startingTime, OFFSET_HOURS);
//                const chargeEndMin = timeStringToMinutesWithOffset(charge.endingTime, OFFSET_HOURS);

//                for (const session of eventSessions) {
//                    const [eventStartMin, eventEndMin] = extractMinutesFromEventTime(session.eventTime);

//                    if (eventStartMin === chargeStartMin && eventEndMin <= chargeEndMin) {
//                        if (!matchingEventTimes.some(mt => mt.eventTime === session.eventTime)) {
//                            matchingEventTimes.push({
//                                eventTime: session.eventTime,
//                                startMin: eventStartMin,
//                                endMin: eventEndMin,
//                                charge: charge.charges,
//                                deliveryCost: charge.charges
//                            });
//                        }
//                    }
//                }
//            }
//            return sortAndRender(matchingEventTimes);
//        }

//        // Priority 3: Special area (only if no same-day or public holiday)
//        if (specialArea) {
//            const areaInfo = JSON.parse(specialArea);
//            const chargeStartMin = timeStringToMinutesWithOffset(areaInfo.startingTime, OFFSET_HOURS);
//            const chargeEndMin = timeStringToMinutesWithOffset(areaInfo.endingTime, OFFSET_HOURS);

//            console.log("📌 Priority 3: Special area charges", areaInfo);

//            for (const session of eventSessions) {
//                const [eventStartMin, eventEndMin] = extractMinutesFromEventTime(session.eventTime);

//                if (eventStartMin === chargeStartMin && eventEndMin === chargeEndMin) {
//                    if (!matchingEventTimes.some(mt => mt.startMin === eventStartMin && mt.endMin === eventEndMin)) {
//                        matchingEventTimes.push({
//                            eventTime: session.eventTime,
//                            startMin: eventStartMin,
//                            endMin: eventEndMin,
//                            charge: areaInfo.charges || 0,
//                            deliveryCost: areaInfo.charges || 0
//                        });
//                    }
//                }
//            }
//            return sortAndRender(matchingEventTimes);
//        }

//        // Priority 4: Normal day charges
//        for (const session of eventSessions) {
//            const [eventStartMin, eventEndMin] = extractMinutesFromEventTime(session.eventTime);

//            for (const charge of applicableCharges) {
//                if (!charge.startingTime || !charge.endingTime) continue;

//                const chargeStartMin = timeStringToMinutesWithOffset(charge.startingTime, OFFSET_HOURS);
//                const chargeEndMin = timeStringToMinutesWithOffset(charge.endingTime, OFFSET_HOURS);

//                if (eventStartMin === chargeStartMin && eventEndMin <= chargeEndMin) {
//                    if (!matchingEventTimes.some(mt => mt.eventTime === session.eventTime)) {
//                        matchingEventTimes.push({
//                            eventTime: session.eventTime,
//                            startMin: eventStartMin,
//                            endMin: eventEndMin,
//                            charge: charge.charges,
//                            deliveryCost: charge.charges
//                        });
//                    }
//                    break;
//                }
//            }
//        }

//        return sortAndRender(matchingEventTimes);

//        function sortAndRender(events) {
//            const uniqueEventsMap = new Map();
//            for (const e of events) {
//                uniqueEventsMap.set(e.eventTime, e);
//            }
//            const uniqueEvents = Array.from(uniqueEventsMap.values());
//            uniqueEvents.sort((a, b) => a.startMin - b.startMin);

//            if (uniqueEvents.length > 0) {
//                const deliveryCost = uniqueEvents[0].deliveryCost || 0;
//                document.getElementById("shippingPrice").textContent = `SGD$ ${deliveryCost.toFixed(2)}`;
//                document.getElementById("shipping-price").textContent = `Charge : SGD$ ${deliveryCost.toFixed(2)}`;
//                document.getElementById("shippingDesc").style.display = "none";
//                document.getElementById("shippingPrice").style.display = "block";

//                // Use global gst here
//                const subTotalText = document.getElementById("subTotal").textContent.trim();
//                const subtotal = parseFloat(subTotalText.replace(/[^\d.]/g, '')) || 0;
//                const tax = (subtotal + deliveryCost) * gst;
//                const total = subtotal + deliveryCost + tax;

//                document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//                document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
//                document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;

//                sessionStorage.setItem("Tax", tax.toFixed(2));
//                sessionStorage.setItem("Shipping", deliveryCost.toFixed(2));
//                sessionStorage.setItem("SubTotal", total.toFixed(2));
//            }
//            //else {
//            //    document.getElementById("shippingDesc").style.display = "block";
//            //    document.getElementById("shippingPrice").style.display = "none";

//            //    document.querySelector(".total-line-tax_price").textContent = `SGD$ 0.00`;
//            //    const subTotalText = document.getElementById("subTotal").textContent.trim();
//            //    const subtotal = parseFloat(subTotalText.replace(/[^\d.]/g, '')) || 0;
//            //    document.getElementById("total-price").innerText = `SGD$ ${subtotal.toFixed(2)}`;
//            //    document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${subtotal.toFixed(2)}`;

//            //    sessionStorage.setItem("Tax", "0.00");
//            //    sessionStorage.setItem("Shipping", "0.00");
//            //    sessionStorage.setItem("SubTotal", subtotal.toFixed(2));
//            //}

//            return uniqueEvents;
//        }

//    }

//    function getMatchingEventTimesStrings(eventTimes, applicableCharges) {
//        // Use your existing filterEventTimesByCharges function to get matched events
//        const matchedEvents = filterEventTimesByCharges(eventTimes, applicableCharges);
//        // Map matched events to only the eventTime string
//        return matchedEvents;
//    }

//});
//function calLiftChargeFee2() {
//    const cartPriceAmount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];
//    const discount = cartPriceAmount[0]?.discountCode || '';
//    let disPercent = cartPriceAmount[0]?.discountPercentage || 0;
//    if (disPercent > 1) disPercent = disPercent / 100;
//    const disSubTotal = parseFloat(cartPriceAmount[0]?.disSubTotal || 0);

//    const lift = document.getElementById("isunitatliftlevel").value;
//    const subTotal = parseFloat(document.getElementById("subTotal").innerText.replace(/[^\d.]/g, '')) || 0;

//    // Get base delivery from session (should be without time slot and lift charges)
//    const baseDelivery = parseFloat(sessionStorage.getItem("deliveryCharges")) || 0;
//    const freeDeliveryPromo = sessionStorage.getItem("freeDeliveryPromo");

//    // Time slot charge
//    let timeSlotCharge = 0;
//    const deliverySelect = document.getElementById("dmeta2");
//    if (deliverySelect && deliverySelect.value) {
//        try {
//            const selectedDelivery = JSON.parse(deliverySelect.value);
//            timeSlotCharge = parseFloat(selectedDelivery.cost) || 0;
//        } catch (err) {
//            console.warn("Failed to parse delivery time slot", err);
//        }
//    }

//    // Lift charge
//    let liftCharge = 0;
//    if (lift === "N") {
//        try {
//            const selectedLift = JSON.parse(document.getElementById("floorlevelcharges").value);
//            liftCharge = parseFloat(selectedLift.cost) || 0;
//        } catch (err) {
//            console.warn("Failed to parse floor level charges", err);
//        }

//        // Apply free delivery promo override
//        if (freeDeliveryPromo != null && freeDeliveryPromo !== "null") {
//            const promoVal = parseFloat(freeDeliveryPromo);
//            if (!isNaN(promoVal)) liftCharge = promoVal;
//        }
//    } else {
//        liftCharge = 0; // Yes → no charge
//    }

//    // Shipping before discount
//    const shippingBeforeDiscount = baseDelivery + timeSlotCharge + liftCharge;

//    // Apply discount if exists
//    let shippingAfterDiscount = shippingBeforeDiscount;
//    if (discount) {
//        cartPriceAmount[0].discountAmt = shippingBeforeDiscount * disPercent;
//        localStorage.setItem("cartDiscountAmount", JSON.stringify(cartPriceAmount));
//        shippingAfterDiscount = shippingBeforeDiscount * (1 - disPercent);
//    }

//    // Update UI
//    $('#shippingPrice').text(`SGD$ ${shippingAfterDiscount.toFixed(2)}`);
//    $('#shipping-price').text(`Charge : SGD$ ${shippingAfterDiscount.toFixed(2)}`);

//    const taxableBase = (discount ? disSubTotal : subTotal) + shippingAfterDiscount;
//    const tax = taxableBase * gst;
//    const total = taxableBase + tax;

//    sessionStorage.setItem("SubTotal", total.toFixed(2));
//    sessionStorage.setItem("Tax", tax.toFixed(2));
//    sessionStorage.setItem("liftCharges", liftCharge.toFixed(2));

//    document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//    document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
//    document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;
//}




//function calLiftChargeFee2() {
//    // Retrieve discount and related information from localStorage
//    const cartPriceAmount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];
//    const discount = cartPriceAmount[0]?.discountCode || '';
//    let disPercent = cartPriceAmount[0]?.discountPercentage || 0;
//    let disSubTotal = cartPriceAmount[0]?.disSubTotal || 0;

//    // Retrieve the lift option from the UI and other related values
//    const lift = document.getElementById("isunitatliftlevel").value;
//    let subTotalText = document.getElementById("subTotal").innerText;
//    let subTotal = parseFloat(subTotalText.replace(/[^\d.]/g, ''));

//    //let subTotal = document.getElementById("subTotal").value;
//    //let subTotal = parseFloat(sessionStorage.getItem("currentSubtotal")) || 0;
//    let deliveryCharges = parseFloat(sessionStorage.getItem("deliveryCharges")) || 0;
//    let freedeliveryPromo = sessionStorage.getItem("freeDeliveryPromo");

//    // If lift is "N", calculate the lift charge and update totals
//    if (lift === "N") {
//        const selectedLift = JSON.parse(document.getElementById("floorlevelcharges").value);
//        let liftCharge = parseFloat(selectedLift.cost) || 0;
//        if (freedeliveryPromo != null && freedeliveryPromo !== "null") {
//            liftCharge = parseFloat(freedeliveryPromo);
//        }
//        if (discount) {
//            cartPriceAmount[0].discountAmt = (liftCharge * disPercent) + (deliveryCharges * disPercent);

//            // Calculate discounted lift charge and update discount amount in cartPriceAmount
//            let discountedLiftCharge = liftCharge - (liftCharge * disPercent);
//            let discountedDeliveryCharge = deliveryCharges - (deliveryCharges * disPercent);

//            // Update discount amount in localStorage
//            localStorage.setItem("cartDiscountAmount", JSON.stringify(cartPriceAmount));

//            // Adjust delivery charges with the discount percentage
//            deliveryCharges = discountedDeliveryCharge + discountedLiftCharge;

//            // Update the shipping price with the discounted amount
//            $('#shippingPrice').text(`SGD$ ${deliveryCharges.toFixed(2)}`);
//            $('#shipping-price').text(`Charge : SGD$ ${deliveryCharges.toFixed(2)}`);

//            // Recalculate tax and total with the discounted delivery charges
//            let tax = (parseFloat(disSubTotal) + deliveryCharges) * gst;
//            let total = parseFloat(disSubTotal) + deliveryCharges + tax;
//            sessionStorage.setItem("SubTotal", total.toFixed(2));
//            sessionStorage.setItem("Tax", tax.toFixed(2));

//            // Update tax and total UI elements with the discount applied
//            document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//            document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
//            document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;
//        } else {
//            // Add lift charge to delivery charges if there's no discount
//            deliveryCharges += liftCharge;
//            $('#shippingPrice').text(`SGD$ ${deliveryCharges.toFixed(2)}`);
//            $('#shipping-price').text(`Charge : SGD$ ${deliveryCharges.toFixed(2)}`);

//            // Recalculate tax and total (without discount)
//            let tax = (parseFloat(subTotal) + parseFloat(deliveryCharges)) * gst;
//            let total = parseFloat(subTotal) + parseFloat(deliveryCharges) + tax;
//            sessionStorage.setItem("SubTotal", total.toFixed(2));
//            sessionStorage.setItem("Tax", tax.toFixed(2));

//            // Update tax and total UI elements
//            document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//            document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
//            document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;
//        }

//        sessionStorage.setItem("liftCharges", liftCharge.toFixed(2));
//    } else {
//        // Handle case when lift is not "N"
//        if (discount) {
//            // Apply discount to delivery charges
//            deliveryCharges -= deliveryCharges * disPercent;

//            // Update the shipping price with the discounted amount
//            $('#shippingPrice').text(`SGD$ ${deliveryCharges.toFixed(2)}`);
//            $('#shipping-price').text(`Charge : SGD$ ${deliveryCharges.toFixed(2)}`);

//            // Recalculate tax and total with the discounted delivery charges
//            let tax = (parseFloat(disSubTotal) + deliveryCharges) * gst;
//            let total = parseFloat(disSubTotal) + deliveryCharges + tax;
//            sessionStorage.setItem("SubTotal", total.toFixed(2));
//            sessionStorage.setItem("Tax", tax.toFixed(2));

//            // Update tax and total UI elements with the discount applied
//            document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//            document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
//            document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;
//        } else {
//            // No discount, update the shipping price normally
//            $('#shippingPrice').text(`SGD$ ${deliveryCharges.toFixed(2)}`);
//            $('#shipping-price').text(`Charge : SGD$ ${deliveryCharges.toFixed(2)}`);

//            // Recalculate tax and total (without discount)
//            let tax = (parseFloat(subTotal) + parseFloat(deliveryCharges)) * gst;
//            let total = parseFloat(subTotal) + parseFloat(deliveryCharges) + tax;
//            sessionStorage.setItem("SubTotal", total.toFixed(2));
//            sessionStorage.setItem("Tax", tax.toFixed(2));

//            // Update tax and total UI elements
//            document.querySelector(".total-line-tax_price").textContent = `SGD$ ${tax.toFixed(2)}`;
//            document.getElementById("total-price").innerText = `SGD$ ${total.toFixed(2)}`;
//            document.getElementById("summary-toggle-total-price").textContent = `SGD$ ${total.toFixed(2)}`;
//        }

//        sessionStorage.setItem("liftCharges", 0);
//    }
//}
function selectLift() {
    var fieldGroups = document.getElementById("isunitatliftlevel");
    var selectedElement = fieldGroups.value;

    $.ajax({
        type: "GET",
        dataType: "json",
        url: "/SR/GetLift",

        success: function (data) {
            const parsedData = data.data ? JSON.parse(data.data) : data;
            console.log("liftcharges:", data);

            // 🔽 Sort by charges ascending
            const sortedData = parsedData.response.data.sort((a, b) => a.charges - b.charges);
            const count = sortedData.length;
            console.log("count:", count);

            // Clear existing options
            const floorLevelSelect = document.getElementById("floorlevelcharges");
            floorLevelSelect.innerHTML = "";

            for (let x = 0; x < count; x++) {
                const item = sortedData[x];
                const optionHTML = `
                <option value='{
                    "title": "${item.liftLevel}",
                    "item_descr": "${item.description}",
                    "ltitle": "Floor Level charges",
                    "price": "${item.charges}",
                    "cost": "${item.charges}",
                    "item_id": "${item.charges}",
                    "item_no": "${item.id}"
                }'>
                    ${item.liftLevel} $${item.charges}
                </option>`;

                floorLevelSelect.innerHTML += optionHTML;
            }
            var getFreeDelivery = sessionStorage.getItem("freeDeliveryPromo");

            if (getFreeDelivery !== null && getFreeDelivery !== "null") {
                calculateFreeCharges();
                console.log("freeDelivery");
            } else {
                console.log("NofreeDelivery");
                sessionStorage.removeItem("freeDeliveryPromo"); // optional cleanup
                calLiftChargeFee();
            }

        }
    });

    // Toggle display based on selected value
    document.getElementById("fg").style.display = selectedElement === "N" ? "block" : "none";
}


async function loadCollectionTime() {
    const cacheKey = "collectionTimes";
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
        const pickupTimes = JSON.parse(cachedData);
        renderPickupOptions(pickupTimes);
        return pickupTimes;
    }

    return new Promise((resolve, reject) => {
        $.ajax({
            type: "GET",
            dataType: "json",
            url: "/SR/CollectionTime",
            success: function (data) {
                const items = data.data ? JSON.parse(data.data) : {};
                const eventTimes = items.response?.data || [];
                console.log("CollectTime Data:", eventTimes);

                // ✅ Filter for pickup/collection times only
                const pickupTimes = eventTimes.filter(event => {
                    const desc = (event.description || '').toLowerCase();
                    return desc.includes('pickup') ||
                        desc.includes('collection') ||
                        desc.includes('pick up');
                });

                // Sort by sortSeq
                pickupTimes.sort((a, b) => a.sortSeq - b.sortSeq);

                // ✅ Cache the filtered pickup times
                sessionStorage.setItem(cacheKey, JSON.stringify(pickupTimes));

                renderPickupOptions(pickupTimes);
                console.log(`✅ Loaded and cached ${pickupTimes.length} pickup time slots`);
                resolve(pickupTimes);
            },
            error: function (xhr, status, error) {
                console.error("❌ Failed to load collection times:", error);
                reject(error);
            }
        });
    });
}

// ✅ Helper function to render pickup options
function renderPickupOptions(pickupTimes) {
    const dropdown = document.getElementById("dmeta3");
    if (!dropdown) {
        console.warn("⚠️ Pickup dropdown (dmeta3) not found");
        return;
    }

    let collectionOptionsHtml = '';

    pickupTimes.forEach((event) => {
        const { eventTime, description, collectionTimeCharges: price, chargedProduct$_identifier: chargedProd, id } = event;
        const displayPrice = (price == 0 || price == null) ? '' : `${price}`;

        collectionOptionsHtml += `
            <option value='{
                "title": "${eventTime}",
                "item_descr": "${description || 'null'}",
                "ltitle": "Collection Time",
                "price": ${price || 0},
                "cost": ${price || 0},
                "item_no": "${chargedProd || ''}",
                "item_id": "${id}"
            }'>
                ${eventTime} ${displayPrice}
            </option>
        `;
    });

    dropdown.innerHTML = collectionOptionsHtml;
}

// Global in-memory cache variable


function loadAreaSpecialChargesByDay() {

    if (dayChargesCache) {
        console.log("📦 Loaded day charges from cache:", dayChargesCache);
        return;
    }

    $.ajax({
        type: "GET",
        url: "/SR/CalAreaSpecialChargesByDay",
        dataType: "json",
        success: function (response) {
            const chargesData = response?.response?.data || [];

            if (chargesData.length > 0) {
                dayChargesCache = chargesData;  // Cache in memory

                console.log("✅ Cached day charges:", dayChargesCache);
            } else {
                console.warn("⚠️ No day charges found.");
                dayChargesCache = [];
            }
        },
        error: function (xhr, status, error) {
            console.error("❌ Failed to load day charges:", error);
            dayChargesCache = [];
        }
    });
}

async function GetAllPublicHolidayDeliveryApi() {
    try {
        const apiUrl = `/SR/AllPublicHolidayAreaCharges`;

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        // Store date + description in cache
        if (result && result.response && result.response.data) {
            publicHolidayCache = result.response.data.map(item => ({
                date: item.deliveryDate,      // e.g. "2025-08-11"
                description: item.description, // e.g. "Public Holiday + Is Same Day"
                charges: item.charges // make sure API returns this

            }));
        }

        console.log("✅ Public holidays cached:", publicHolidayCache);
        return publicHolidayCache;

    } catch (error) {
        console.error('API Error:', error);
        updateDeliveryBanner({ error: 'Failed to check delivery status' });
        return false;
    }
}


async function initBlockedDates() {
    console.log("Datepicker initialized at:", new Date().toLocaleString(), "(", new Date().getTime(), "ms )");

    await GetAllPublicHolidayDeliveryApi(); // populate publicHolidayCache

    fetchBlockedDatesFromApi(function () {
        const $datepicker = $('#appb9114bc45ab4c429_selected_date');
        const $datepickerPickup = $('#datepicker');

        // --- Helper Functions ---
        function formatYMD(date) {
            const yyyy = date.getFullYear();
            const mm = ('0' + (date.getMonth() + 1)).slice(-2);
            const dd = ('0' + date.getDate()).slice(-2);
            return `${yyyy}-${mm}-${dd}`;
        }
        // Unblock special occasion Sundays
        const specialOccasions = publicHolidayCache
            .filter(h => h.description)
            .map(h => h.date);
        function calculateMinSelectableDate(baseDate, leadDays, blockedDates, specialOccasions) {
            let current = new Date(baseDate);
            let counted = 0;

            while (counted < leadDays) {
                const ymd = formatYMD(current);
                const day = current.getDay();
                const isSunday = day === 0;
                const isBlocked = blockedDates.includes(ymd);

                // ✅ Allow Sunday if it's a special occasion
                if (!isBlocked && (!isSunday || specialOccasions.includes(ymd))) {
                    counted++;
                }

                current.setDate(current.getDate() + 1);
            }
            return current;
        }


        function getBeforeShowDay(date) {
            const now = new Date();
            const ymd = formatYMD(date);
            let result = { enabled: true, classes: '', tooltip: '' };

            // Base date for 4-day lead time
            let baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (now.getHours() >= 11) baseDate.setDate(baseDate.getDate() + 1);

            let dynamicBlockedDates = [...blockedDates];

            // Add Sundays for the next 30 days
            for (let i = 0; i < 30; i++) {
                const temp = new Date(baseDate);
                temp.setDate(temp.getDate() + i);
                if (temp.getDay() === 0) {
                    const tempYMD = formatYMD(temp);
                    if (!dynamicBlockedDates.includes(tempYMD)) dynamicBlockedDates.push(tempYMD);
                }
            }

            const minSelectableDate = calculateMinSelectableDate(baseDate, 5, dynamicBlockedDates, specialOccasions);
            minSelectableDate.setHours(0, 0, 0, 0);

            const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Block past dates
            if (selectedDate < today) {
                result.enabled = false;
                result.classes = 'blocked-date';
                result.tooltip = 'Past date';
            }
            // Block dates before min selectable
            else if (selectedDate < minSelectableDate) {
                result.enabled = false;
                result.classes = 'blocked-date';
                result.tooltip = 'Date is before minimum allowed (5 business days from today)';
            }
            // Block other holidays/Sundays
            else if (dynamicBlockedDates.includes(ymd)) {
                result.enabled = false;
                result.classes = 'blocked-date';
                result.tooltip = 'Date is blocked (holiday or Sunday)';
            }
            if (specialOccasions.includes(ymd) && date.getDay() === 0 && selectedDate >= today) {
                result.enabled = true;
                result.classes = '';
                result.tooltip = 'Special occasion Sunday – selectable';
            }

            return result;
        }

        // --- Refresh delivery charge based on 6R or selected date ---
        function refreshDeliveryCharge() {
            const is6R = sessionStorage.getItem("6R") === "Yes";
            if (is6R) {
                console.log("⚡ 6R session active – setting delivery");
                updateUIWithCharges(price6R);
            }
            //else {
            //    const selectedDate = $datepicker.datepicker('getDate');
            //    if (selectedDate) {
            //        // Call your existing function to recalc delivery based on date
            //        recalcDeliveryChargeForDate(selectedDate);
            //    }
            //}
        }

        // --- Initialize Datepicker ---
        $datepicker.datepicker({
            format: 'yyyy-mm-dd',
            autoclose: true,
            todayHighlight: true,
            beforeShowDay: getBeforeShowDay
        }).off('changeDate').on('changeDate', function (e) {
            console.log("Date selected at:", new Date().toLocaleString(), "Selected date:", e.date);
            handleDateChange();
        });


        $datepickerPickup.datepicker({
            format: 'yyyy-mm-dd',
            autoclose: true,
            todayHighlight: true,
            beforeShowDay: getBeforeShowDay
        }).off('changeDate').on('changeDate', function (e) {
            console.log("Pickup date selected:", e.date);
            handleDateChange();
            refreshDeliveryCharge();
        });

        // Refresh on open
        $('#appb9114bc45ab4c429_selected_date, #appb9114bc45ab4c429_datetimepicker .input-group-addon')
            .off('click')
            .on('click', function () {
                console.log("Datepicker opened at:", new Date().toLocaleString());
                $datepicker.datepicker('update', '');
                $datepicker.datepicker('show');

                refreshDeliveryCharge();
            });
    });
}

async function initBlockedPickupDates() {
    fetchBlockedDatesFromApi(function () {
        const $datepickerPickup = $('#datepicker');
        if (!$datepickerPickup.length) return;

        // --- Helper Functions ---
        function formatYMD(date) {
            const yyyy = date.getFullYear();
            const mm = ('0' + (date.getMonth() + 1)).slice(-2);
            const dd = ('0' + date.getDate()).slice(-2);
            return `${yyyy}-${mm}-${dd}`;
        }

        // Safely handle publicHolidayCache
        const specialOccasions = (publicHolidayCache || [])
            .filter(h => h.description)
            .map(h => h.date);

        function calculateMinSelectableDate(baseDate, leadDays, blockedDates) {
            let current = new Date(baseDate);
            let counted = 0;

            while (counted < leadDays) {
                const ymd = formatYMD(current);
                const isBlocked = (blockedDates || []).includes(ymd);

                if (!isBlocked) counted++;
                current.setDate(current.getDate() + 1);
            }
            return current;
        }

        function getBeforeShowDay(date) {
            try {
                const now = new Date();
                const ymd = formatYMD(date);
                let result = { enabled: true, classes: '', tooltip: '' };

                let baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                if (now.getHours() >= 11) {
                    baseDate.setDate(baseDate.getDate() + 1);
                    console.log("⏰ Past 11 AM cut-off, counting from tomorrow:", baseDate.toDateString());
                }

                const dynamicBlockedDates = [...(blockedPickUpDates || [])];
                const minSelectableDate = calculateMinSelectableDate(baseDate, 5, dynamicBlockedDates);
                minSelectableDate.setHours(0, 0, 0, 0);

                const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                if (selectedDate < today) {
                    result = { enabled: false, classes: 'blocked-date', tooltip: 'Past dates are not available' };
                } else if (selectedDate < minSelectableDate) {
                    const cutOffTime = now.getHours() >= 11 ? " (after 11 AM cut-off)" : "";
                    result = { enabled: false, classes: 'blocked-date', tooltip: `Minimum 5 business days required${cutOffTime}` };
                } else if (dynamicBlockedDates.includes(ymd)) {
                    result = { enabled: false, classes: 'blocked-date', tooltip: 'Date is blocked for pickup' };
                }

                // Special occasion Sundays override
                if (specialOccasions.includes(ymd) && date.getDay() === 0 && selectedDate >= minSelectableDate) {
                    result = { enabled: true, classes: 'special-occasion', tooltip: 'Special occasion Sunday – available' };
                }

                return result;
            } catch (err) {
                console.error("getBeforeShowDay error:", err);
                return { enabled: false, classes: 'blocked-date', tooltip: 'Error loading date' };
            }
        }

        // Destroy first to prevent double init
        $datepickerPickup.datepicker('destroy').datepicker({
            format: 'yyyy-mm-dd',
            autoclose: true,
            todayHighlight: true,
            beforeShowDay: getBeforeShowDay
        }).off('changeDate').on('changeDate', function (e) {
            console.log("Pickup date selected:", e.date);

            const validation = getBeforeShowDay(e.date);
            if (!validation.enabled) {
                console.warn("⚠️ Invalid date selected:", validation.tooltip);
            }
            handleDateChange();
        });

        // Click handlers
        $('#appb9114bc45ab4c429_selected_date, #appb9114bc45ab4c429_datetimepicker .input-group-addon, #pickup-datepicker-wrapper')
            .off('click')
            .on('click', function () {
                const now = new Date();
                console.log("Datepicker opened at:", now.toLocaleString());
                console.log("⏰ Cut-off status:", now.getHours() >= 11 ? "Past 11 AM - counting from tomorrow" : "Before 11 AM - counting from today");

                $datepickerPickup.datepicker('update', '');
                $datepickerPickup.datepicker('show');
            });

        console.log("✅ Datepicker initialized with", (blockedPickUpDates || []).length, "blocked dates and", specialOccasions.length, "special occasions.");
    });
}



document.addEventListener("DOMContentLoaded", function () {
    // Adjust to match your checkout URL
    const isCheckoutPage = window.location.href.includes("/Checkout");

    if (isCheckoutPage) {
        loadAreaSpecialChargesByDay();
    } else {
        console.log("⏩ Not checkout page, skipping blocked dates & charges init");
    }
});
async function initDeliveryAndPickup() {
    await loadDeliveryTime();
    await loadCollectionTime();
    console.log("✅ Both delivery and pickup times loaded");
}

// ✅ Call on page load
initDeliveryAndPickup();