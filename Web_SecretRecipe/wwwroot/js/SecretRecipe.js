netsMidIndicator = "U";
let gst = 0.09;
menu_unitPrice = [];
menu_itemName = [];
menu_itemId = [];
menu_productCategory = [];
img_64 = [];
menu_itemQuantity = [];
menu_itemhascollection = [];
menu_desc = [];
jwtToken = null;
var txnRand;
var netsTxnRef;
var netsMidGlobal;
var merchantTxnRef;
var b2sTxnEndURL;
//credit
var gexp;
var gmod;
//test codes
var w;
var merchantInfo;
var isHostedPage;
// Global caches
let menuPackageCache = JSON.parse(sessionStorage.getItem("menuPackageCache")) || null;
let menuCategoriesCache = JSON.parse(sessionStorage.getItem("menuCategoriesCache")) || null;
let menuDropdownCache = JSON.parse(sessionStorage.getItem("menuDropdownCache")) || null;
let menuDropdownFetching = false;
let menuCache = null;
const getImageUrl = id => `/SR/GetImageProxy?imageId=${encodeURIComponent(id)}`;
let coolerBagInfoGlobal = null;

// ── Auto-clear cart if older than 1 day ──────────────────────
const CART_KEY = 'cart';
const CART_TIMESTAMP_KEY = 'cart_timestamp';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;


const cartTimestamp = localStorage.getItem(CART_TIMESTAMP_KEY);
if (cartTimestamp && Date.now() - parseInt(cartTimestamp) > ONE_DAY_MS) {
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(CART_TIMESTAMP_KEY);
    console.log('🧹 Cart cleared — older than 1 day');
}

// Update timestamp whenever cart is modified
const originalSetItem = localStorage.setItem.bind(localStorage);
const _patchedSetItem = (key, value) => {
    originalSetItem(key, value);
    if (key === CART_KEY) {
        originalSetItem(CART_TIMESTAMP_KEY, Date.now().toString());
    }
};
localStorage.setItem = _patchedSetItem;

function getOrgId() {
    fetch('/SR/GetConfig')
        .then(response => response.json())
        .then(data => {
            //console.log("Org ID", data.mySpecificSetting);
            sessionStorage.setItem("Organization", data.mySpecificSetting);
        });
}
getOrgId();
resetIcingSelection();

orgId = sessionStorage.getItem("Organization");

function updateCakeChargeBanner(cakeSizing) {
    let banner = document.getElementById('cake-charge-banner');
    const container = document.getElementById('IcingImg');

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'cake-charge-banner';
        banner.style.marginTop = '10px';
        banner.style.padding = '10px';
        banner.style.borderRadius = '4px';

        if (container && container.parentNode) {
            container.parentNode.insertBefore(banner, container.nextSibling);
        } else {
            document.body.appendChild(banner);
        }
    }

    let IcingCharges = parseFloat(sessionStorage.getItem("IcingCharges")) || 0;
    let message = "";

    // Use the cake sizing value as-is
    if (cakeSizing) {
        message = `${cakeSizing} Size Icing Charge: +$${IcingCharges.toFixed(2)}`;
    }

    if (message && IcingCharges > 0) {
        banner.innerHTML = `🎂 <strong>Cake Size Charge</strong><p>${message}</p>`;
        banner.style.backgroundColor = '#fff4e5';
        banner.style.color = '#a66300';
        banner.style.display = 'block';
    } else {
        banner.style.display = 'none';
    }
}

function deleteImage(event) {
    event.preventDefault();
    var imageId = sessionStorage.getItem("IcingImage");
    if (!imageId) {
        console.warn("⚠️ No image ID found in sessionStorage.");
        document.getElementById("imgInput").value = ""; // clear just in case
        return;
    }

    $.ajax({
        url: `/SR/DeleteIcingImageByID?imageId=${imageId}`,
        type: 'DELETE',
        contentType: 'application/json',
        success: function (response) {
            resetIcingSelection(); // clear everything
            document.getElementById("imgInput").value = "";
            console.log("✅ Image deleted successfully.", response);
        },
        error: function (xhr) {
            console.error(`❌ Delete failed [${xhr.status}]:`, xhr.responseText || "No response text");

            // 🧹 clear input & reset icing selection when delete fails
            document.getElementById("imgInput").value = "";
            resetIcingSelection();
            alert("Failed to delete image. Please try again.");
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    initializeCakeSizeChangeHandler();
});

// Function to initialize the size change handler
function initializeCakeSizeChangeHandler() {
    // Wait for the dropdown to be created by GetProduct()
    const checkDropdown = setInterval(() => {
        const sizeDropdown = document.getElementById('addOnType');

        if (sizeDropdown) {
            clearInterval(checkDropdown);
            console.log('✅ Size dropdown found, attaching event listener');

            // Listen for size selection changes
            sizeDropdown.addEventListener('change', function () {
                const newSize = this.value;
                const newSizeID = this.options[this.selectedIndex].id;
                const listID = this.options[this.selectedIndex].getAttribute('listid');

                console.log(`🔄 Cake size changed to: ${newSize}`);

                // Check if an image was previously uploaded
                const hasUploadedImage = sessionStorage.getItem('IcingImage');

                if (hasUploadedImage && hasUploadedImage !== 'null') {
                    // Prompt user about re-upload
                    const shouldClear = confirm(
                        `You've changed the cake size to ${newSize}.\n\n` +
                        `The icing charge will be updated. Do you want to keep the current image or upload a new one?\n\n` +
                        `Click OK to clear and re-upload, or Cancel to keep the current image.`
                    );

                    if (shouldClear) {
                        clearUploadedImage();
                        alert('Please upload your image again for the new cake size.');
                    } else {
                        // Just update the charge banner with new size
                        updateCakeChargeBannerForNewSize(newSize, listID);
                    }
                } else {
                    // No image uploaded yet, just update the banner if needed
                    const chargeBanner = document.getElementById('cake-charge-banner');
                    if (chargeBanner) {
                        chargeBanner.style.display = 'none';
                    }
                }

                // Update session storage with new size
                sessionStorage.setItem('type', newSize);
                sessionStorage.setItem('typeID', newSizeID);
            });
        }
    }, 100);

    // Stop checking after 5 seconds to prevent infinite loop
    setTimeout(() => clearInterval(checkDropdown), 5000);
}

function clearUploadedImage() {
    const fileInput = document.getElementById('imgInput');
    const deleteButton = document.getElementById('deleteIcing');
    const chargeBanner = document.getElementById('cake-charge-banner');

    // Reset file input
    if (fileInput) {
        fileInput.value = '';
        console.log('✅ File input cleared');
    }

    // Hide delete button
    if (deleteButton) {
        deleteButton.style.display = 'none';
    }

    // Clear sessionStorage
    sessionStorage.setItem('IcingImage', null);
    sessionStorage.removeItem('IcingCharges');
    console.log('✅ Image data cleared from session storage');

    // Hide charge banner
    if (chargeBanner) {
        chargeBanner.style.display = 'none';
    }
}

function updateCakeChargeBannerForNewSize(size, listID) {
    // Call the MenuListAddOn API to get new pricing
    if (!listID) {
        console.warn('No listID provided, cannot fetch new pricing');
        return;
    }

    $.ajax({
        type: "GET",
        dataType: "json",
        url: `/SR/MenuListAddOn?id=${listID}`,
        success: function (data) {
            try {
                const parsed = typeof data.data === "string" ? JSON.parse(data.data) : data.data;
                const responseData = Array.isArray(parsed?.response?.data) ? parsed.response.data : [];

                if (responseData.length > 0) {
                    const extraCharge = parseFloat(responseData[0].unitPrice || 0);

                    // Update session storage
                    sessionStorage.setItem("IcingCharges", extraCharge);
                    sessionStorage.setItem("menulistAddon", JSON.stringify(responseData.map(item => ({
                        id: item.id,
                        productId: item.product,
                        name: item["product$_identifier"] || item._identifier || "Unnamed AddOn",
                        uom: item.uOM,
                        qty: item.quantity || 0,
                        price: parseFloat(item.unitPrice || 0),
                        amount: parseFloat(item.amount || 0),
                    }))));

                    // Update the banner
                    updateCakeChargeBanner(size);
                    console.log(`🎂 Updated charge banner for size: ${size}, charge: $${extraCharge}`);
                }
            } catch (err) {
                console.error("❌ Error parsing AddOn Data:", err, data);
            }
        },
        error: function (xhr, status, error) {
            console.error("MenuListAddOn AJAX Error:", status, error);
        }
    });
}

// Enhanced deleteImage function to work with the re-upload feature
window.deleteImage = function (event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const imageId = sessionStorage.getItem("IcingImage");

    if (!imageId || imageId === 'null') {
        console.warn("⚠️ No image ID found in sessionStorage.");
        const fileInput = document.getElementById("imgInput");
        if (fileInput) fileInput.value = "";
        return;
    }


    $.ajax({
        url: `/SR/DeleteIcingImageByID?imageId=${imageId}`,
        type: 'DELETE',
        contentType: 'application/json',
        success: function (response) {
            clearUploadedImage();
            console.log("✅ Image deleted successfully.", response);
        },
        error: function (xhr) {
            console.error(`❌ Delete failed [${xhr.status}]:`, xhr.responseText || "No response text");

            // Clear input & reset icing selection even if delete fails
            const fileInput = document.getElementById("imgInput");
            if (fileInput) fileInput.value = "";
            clearUploadedImage();
            alert("Failed to delete image. Please try again.");
        }
    });
};

// Optional: Add visual indicator when file input is ready for new upload
document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('imgInput');

    if (fileInput) {
        fileInput.addEventListener('change', function () {
            if (this.files && this.files[0]) {
                console.log('📁 New file selected:', this.files[0].name);

                // Show delete button when file is selected
                const deleteButton = document.getElementById('deleteIcing');
                if (deleteButton) {
                    deleteButton.style.display = 'inline-block';
                }
            }
        });
    }
});

function uploadImage(fileInput) {
    const file = fileInput.files[0];
    if (!file) {
        alert("Please select a file.");
        return;
    }

    // 🧩 Validate file type
    if (!file.type.startsWith('image/')) {
        alert("Please upload a valid image file.");
        fileInput.value = "";
        return;
    }

    // 🧩 Validate size (<= 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert("Image size should not exceed 5MB.");
        fileInput.value = "";
        return;
    }

    // 🧩 Get safe file extension
    function getSafeImageExtension(filename, mimeType) {
        // Priority 1: Use filename extension (most reliable)
        const filenameParts = filename.split('.');
        if (filenameParts.length > 1) {
            const filenameExt = filenameParts.pop().toLowerCase();
            const validImageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];

            if (validImageExts.includes(filenameExt)) {
                // Normalize jpeg to jpg
                return filenameExt === 'jpeg' ? 'jpg' : filenameExt;
            }
        }

        // Priority 2: Use MIME type with comprehensive mapping
        if (mimeType) {
            const mimeExt = mimeType.split('/')[1];
            const mimeMap = {
                'jpeg': 'jpg',
                'pjpeg': 'jpg',
                'jpg': 'jpg',
                'png': 'png',
                'gif': 'gif',
                'webp': 'webp',
                'bmp': 'bmp',
                'svg+xml': 'svg'
            };
            const extension = mimeMap[mimeExt] || mimeExt;
            return extension === 'jpeg' ? 'jpg' : extension;
        }

        // Final fallback
        return 'jpg';
    }

    // 🧩 Convert image to desired format (JPEG/PNG)
    function convertImageToBinary(img, targetFormat) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Set canvas dimensions to image dimensions
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw image on canvas
            ctx.drawImage(img, 0, 0);

            try {
                // Convert to target format
                let dataUrl;
                if (targetFormat === 'png') {
                    dataUrl = canvas.toDataURL('image/png');
                } else {
                    // Default to JPEG with 92% quality
                    dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                }

                // Extract base64 binary data
                const base64Data = dataUrl.split(',')[1];
                resolve({
                    binaryData: base64Data,
                    mimeType: targetFormat === 'png' ? 'image/png' : 'image/jpeg',
                    extension: targetFormat === 'png' ? 'png' : 'jpg',
                    width: img.width,
                    height: img.height
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = async function () {
            try {
                // 🧩 Determine target format (you can modify this logic)
                const originalExt = getSafeImageExtension(file.name, file.type);
                let targetFormat = 'jpg'; // Default to JPEG

                // If original is PNG and you want to preserve transparency, use PNG
                // Otherwise convert to JPEG for better compression
                if (originalExt === 'png') {
                    // Check if image has transparency
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const hasTransparency = hasTransparentPixels(imageData);

                    targetFormat = hasTransparency ? 'png' : 'jpg';
                } else if (originalExt === 'gif' || originalExt === 'bmp' || originalExt === 'webp') {
                    // Convert non-standard formats to JPEG
                    targetFormat = 'jpg';
                }

                console.log(`🔄 Converting image from ${originalExt} to ${targetFormat}`);

                // Convert image to target format
                const convertedImage = await convertImageToBinary(img, targetFormat);

                const cakeSizing = sessionStorage.getItem("type");
                const payload = {
                    entityName: "ADImage",
                    organization: orgId,
                    name: file.name.replace(/\.[^/.]+$/, ""), // remove old ext if any
                    BindaryData: convertedImage.binaryData,
                    Extension: convertedImage.extension,
                    MimeType: convertedImage.mimeType,
                    Width: convertedImage.width,
                    Height: convertedImage.height
                };

                console.log('📤 Upload payload:', {
                    entityName: payload.entityName,
                    organization: payload.organization,
                    name: payload.name,
                    Extension: payload.Extension,
                    MimeType: payload.MimeType,
                    Dimensions: `${payload.Width}x${payload.Height}`,
                    dataSize: convertedImage.binaryData.length
                });

                $.ajax({
                    url: '/SR/PostCakeWritingImage',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(payload),
                    success: function (response) {
                        let parsedMessage;
                        try {
                            parsedMessage = JSON.parse(response.message);
                        } catch (e) {
                            console.error("❌ Failed to parse `message`:", e);
                            alert("Unexpected server response format.");
                            fileInput.value = "";
                            return;
                        }

                        const imageId = parsedMessage?.response?.data?.[0]?.id;
                        const menulistAddon = JSON.parse(sessionStorage.getItem("menulistAddon") || "[]");

                        if (imageId) {
                            if (cakeSizing) {
                                let extraCharge = 0;
                                if (menulistAddon.length > 0) {
                                    extraCharge = menulistAddon[0].price;
                                }

                                sessionStorage.setItem("IcingCharges", extraCharge);
                                updateCakeChargeBanner(cakeSizing);
                                console.log(`🎂 Cake size: ${cakeSizing}, extra charge applied: $${extraCharge}`);
                            }

                            sessionStorage.setItem("IcingImage", imageId);
                            console.log('✅ Image uploaded and converted successfully. Image ID:', imageId);
                            alert("Image uploaded successfully.");
                        } else {
                            console.warn("❗ No image ID found in parsed message.");
                            console.log('🔍 Full response:', response);
                            console.log('🔍 Parsed message:', parsedMessage);
                            alert("Upload failed, please check your image size or name format and length.");
                            fileInput.value = "";
                        }
                    },
                    error: function (xhr) {
                        console.error(`❌ Upload failed [${xhr.status}]:`, xhr.responseText || "No response text");
                        alert("Upload failed: " + (xhr.responseText || "Unknown error occurred."));
                        fileInput.value = "";
                    }
                });

            } catch (error) {
                console.error('❌ Image conversion failed:', error);
                alert("Failed to process image. Please try another image.");
                fileInput.value = "";
            }
        };

        img.onerror = function () {
            alert("Failed to load image. The file may be corrupted.");
            fileInput.value = "";
        };

        img.src = e.target.result;
    };

    reader.onerror = function () {
        alert("Failed to read file.");
        fileInput.value = "";
    };

    reader.readAsDataURL(file);
}

// 🧩 Helper function to check for transparent pixels
function hasTransparentPixels(imageData) {
    const data = imageData.data;
    for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) {
            return true; // Found a transparent or semi-transparent pixel
        }
    }
    return false;
}

// 🧩 Alternative simplified version if you always want JPEG
function uploadImageAsJpeg(fileInput) {
    const file = fileInput.files[0];
    if (!file) {
        alert("Please select a file.");
        return;
    }

    if (!file.type.startsWith('image/')) {
        alert("Please upload a valid image file.");
        fileInput.value = "";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert("Image size should not exceed 5MB.");
        fileInput.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.width;
            canvas.height = img.height;

            // Draw white background first (for JPEG)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw the image
            ctx.drawImage(img, 0, 0);

            // Convert to JPEG
            const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
            const base64Binary = jpegDataUrl.split(',')[1];

            const cakeSizing = sessionStorage.getItem("type");
            const payload = {
                entityName: "ADImage",
                organization: orgId,
                name: file.name.replace(/\.[^/.]+$/, ""),
                BindaryData: base64Binary,
                Extension: 'jpg',
                MimeType: 'image/jpeg',
                Width: img.width,
                Height: img.height
            };

            console.log('📤 Uploading as JPEG:', {
                name: payload.name,
                dimensions: `${payload.Width}x${payload.Height}`
            });

            // Continue with your existing AJAX call...
            $.ajax({
                url: '/SR/PostCakeWritingImage',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(payload),
                success: function (response) {
                    // Your existing success handling code...
                    let parsedMessage;
                    try {
                        parsedMessage = JSON.parse(response.message);
                    } catch (e) {
                        console.error("❌ Failed to parse `message`:", e);
                        alert("Unexpected server response format.");
                        fileInput.value = "";
                        return;
                    }

                    const imageId = parsedMessage?.response?.data?.[0]?.id;
                    const menulistAddon = JSON.parse(sessionStorage.getItem("menulistAddon") || "[]");

                    if (imageId) {
                        if (cakeSizing) {
                            let extraCharge = 0;
                            if (menulistAddon.length > 0) {
                                extraCharge = menulistAddon[0].price;
                            }
                            sessionStorage.setItem("IcingCharges", extraCharge);
                            updateCakeChargeBanner(cakeSizing);
                        }
                        sessionStorage.setItem("IcingImage", imageId);
                        alert("Image uploaded successfully.");
                    } else {
                        alert("Upload failed, please check your image.");
                        fileInput.value = "";
                    }
                },
                error: function (xhr) {
                    console.error(`❌ Upload failed:`, xhr.responseText);
                    alert("Upload failed.");
                    fileInput.value = "";
                }
            });
        };

        img.onerror = function () {
            alert("Failed to load image.");
            fileInput.value = "";
        };

        img.src = e.target.result;
    };

    reader.onerror = function () {
        alert("Failed to read file.");
        fileInput.value = "";
    };

    reader.readAsDataURL(file);
}


// Load all products if cache is empty
if (!menuPackageCache) {
    loadProductsForCategory();
}

// Load all categories if cache is empty
if (!menuCategoriesCache) {
    GetMenuCategories();
}

// -----------------------
// Products
// -----------------------

// Call this on checkout page load


// Example: run on page load
function loadProductsForCategory() {
    const mainProductGrid = document.getElementById('cakesMenu');
    const loader = document.getElementById('loaderCakes');

    if (mainProductGrid && loader) {
        loader.style.display = 'block';
        mainProductGrid.classList.add('loading');
    }

    if (menuPackageCache && Array.isArray(menuPackageCache) && menuPackageCache.length > 0) {
        if (mainProductGrid) renderProducts(menuPackageCache, mainProductGrid, loader);
        return;
    }

    $.ajax({
        type: "GET",
        dataType: "json",
        cache: false,
        url: "/SR/GetAllMenuPackageSession",
        success: function (data) {
            try {
                let responseData = data?.response?.data;

                if (typeof data.data === 'string') {
                    const parsed = JSON.parse(data.data);
                    responseData = parsed?.response?.data;
                }

                if (!Array.isArray(responseData) || responseData.length === 0) {

                    if (mainProductGrid) {
                        mainProductGrid.innerHTML = '<div class="error-message">No menu items found.</div>';
                    }
                    return;
                }


                // Save in cache & sessionStorage
                menuPackageCache = responseData;
                sessionStorage.setItem("menuPackageCache", JSON.stringify(menuPackageCache));

                if (mainProductGrid) {
                    renderProducts(menuPackageCache, mainProductGrid, loader);
                }
            } catch (error) {
                console.error("Error handling menu data:", error);
                if (mainProductGrid) {
                    mainProductGrid.innerHTML = '<div class="error-message">Error loading menu items.</div>';
                }
            } finally {
                if (mainProductGrid && loader) loader.style.display = 'none';
                if (mainProductGrid) mainProductGrid.classList.remove('loading');
            }
        },
        error: function () {
            if (mainProductGrid) {
                mainProductGrid.innerHTML = '<div class="error-message">Failed to load menu items. Please try again later.</div>';
                mainProductGrid.classList.remove('loading');
            }
            if (loader) loader.style.display = 'none';
        }
    });
}


document.addEventListener("DOMContentLoaded", function () {
    const loader = document.querySelector('.full-page-overlay');
    const stickyHeader = document.getElementById('easystore-section-header');
    const announcementBar = document.getElementById('announcement-bar');

    // Make elements sticky
    function setStickyElements() {
        if (!stickyHeader) return;

        // Announcement bar sticky
        if (announcementBar) {
            announcementBar.style.position = 'sticky';
            announcementBar.style.top = '0';
            announcementBar.style.zIndex = '9998'; // behind loader
            announcementBar.style.transition = 'top 0.3s ease';
        }

        // Header sticky below announcement bar
        stickyHeader.style.position = 'sticky';
        stickyHeader.style.transition = 'top 0.3s ease';
        updateHeaderTop();
    }

    // Update header top based on announcement bar visibility
    function updateHeaderTop() {
        if (!stickyHeader) return;

        let offset = 0;
        if (announcementBar &&
            announcementBar.offsetHeight > 0 &&
            getComputedStyle(announcementBar).display !== 'none' &&
            !announcementBar.hidden) {
            offset = announcementBar.offsetHeight;
        }

        stickyHeader.style.top = `${offset}px`;
    }

    // Temporarily static header during loader
    function setHeaderStatic() {
        if (!stickyHeader) return;
        stickyHeader.style.position = 'static';
        stickyHeader.style.top = '0';
    }

    setHeaderStatic();

    function onLoaderEnd() {
        setStickyElements();
        if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
        setupAnnouncementObserver();
    }

    if (loader) {
        loader.addEventListener('animationend', onLoaderEnd, { once: true });
        loader.addEventListener('transitionend', onLoaderEnd, { once: true });
        setTimeout(onLoaderEnd, 3000); // fallback
    } else {
        setStickyElements();
        setupAnnouncementObserver();
    }

    // Observe announcement bar changes
    function setupAnnouncementObserver() {
        if (!announcementBar || !stickyHeader) return;

        let debounceTimer;
        const debounce = (fn, delay = 100) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(fn, delay);
        };

        const observer = new MutationObserver(() => debounce(updateHeaderTop));
        observer.observe(announcementBar, {
            attributes: true,
            attributeFilter: ['style', 'hidden'],
            childList: true,
            subtree: true
        });

        window.addEventListener('resize', () => debounce(updateHeaderTop, 200));
    }

    cartCount();
});




function handleEmptyServiceList(msgData) {
    $("#ajaxResponse").html("");
    console.log("Empty merchantSvcList condition met.");

    if (!jQuery.isEmptyObject(msgData.stageRespCode)) {
        if (jQuery.isEmptyObject(msgData.b2sTxnEndURL)) {
            writeErrorInfo(msgData.stageRespCode, msgData.actionCode);
        } else if (
            msgData.allDistraFlag === 'Y' ||
            (!jQuery.isEmptyObject(msgData.hmac) && !jQuery.isEmptyObject(msgData.rawMsg))
        ) {
            processErrorPage(JSON.stringify(msgData), null, null, null);
        } else {
            writeErrorInfo(msgData.stageRespCode, msgData.actionCode);
        }
    } else {
        $("#ajaxResponse").append(msgData.netsTxnMsg || "Unexpected empty response.");
    }
}



//function processServiceList(jSonString, selectedService, netsMid, routeTo) {
//    var msgRefId;
//    var queryTimeoutTimer;
//    // Set default value in milliseconds (e.g., 2000ms = 2 seconds)
//    const intialApsQryCount = 3; // Number of first phase retries
//    const finalApsQryCount = 5;   // Number of second phase retries
//    const intApsQryDuration = 20000; // Interval duration in milliseconds
//    // check if JQuery library is loaded
//    if (typeof jQuery == 'undefined') {
//        alert("[APPS.JS] jQuery NOT loaded ");
//        var jq = document.createElement('script');
//        jq.type = 'text/javascript';
//        // Path to jquery.js file, eg. Google hosted version or local
//        jq.src = gwdomain + '/GW2/js/jquery-3.6.3.min.js';
//        document.getElementsByTagName('head')[0].appendChild(jq);
//    }

//    // AJAX properties for application
//    var contentTypeVal = "application/json";

//    var objStr = typeof jSonString === "string" ? JSON.parse(jSonString) : jSonString;
//    var tsIntMsg = "";
//    var tsMerchMsg = "";
//    var tsStatus = "";

//    console.log(objStr);
//    txnRand = objStr.txnRand;
//    netsTxnRef = objStr.netsTxnRef;
//    netsMidGlobal = netsMid;
//    merchantTxnRef = objStr.merchantTxnRef;
//    b2sTxnEndURL = objStr.b2sTxnEndURL;
//    // Store reference in localStorage for tracking
//    localStorage.setItem("merchantTxnRef", merchantTxnRef);

//    // Retry counters
//    const maxRetries = 5;          // How many times to retry fallback query
//    const retryInterval = 20000; // Retry every 1 minute after timeout (adjust as n
//    let retryCount = 0;
//    let netsAmountDeducted = parseInt(objStr.txnAmount);  // ✅ 6780 (number)

//    setTimeout(() => {
//        function doFallbackQuery() {
//            const resolvedKey = `txn-${merchantTxnRef}-resolved`;
//            const resolved = sessionStorage.getItem(resolvedKey);

//            if (resolved === 'true') {
//                console.log(`[Resolved] Txn ${merchantTxnRef} already resolved. Redirecting...`);
//                window.location.href = "/SecretRecipe/Payment";
//                return;
//            }


//            fetch('/SR/QueryTxnStatus', {
//            //fetch('/SR/QueryEnetsTxn', {
//                method: 'POST',
//                headers: { 'Content-Type': 'application/json' },
//                body: JSON.stringify({
//                    ss: "1",
//                    msg: { merchantTxnRef: merchantTxnRef }
//                })
//            })
//                .then(response => response.json())
//                .then(data => {
//                    console.log("QueryEnetsTxn response:", data);

//                    const txnStatus = data?.msg?.netsTxnStatus;

//                    if (txnStatus === "0") {
//                        sessionStorage.setItem(resolvedKey, "true");
//                        console.log("✅ Transaction success confirmed. Redirecting...");

//                        // Construct message as a JSON string (same as what Return() expects)
//                        const message = JSON.stringify({
//                            netsMid: data.msg.netsMid,
//                            merchantTxnRef: data.msg.merchantTxnRef,
//                            netsMidIndicator: netsMidIndicator
//                        });
//                        console.log("")

//                        // 1. Construct fullPayload string (same as what Return() expects)
//                        const fullPayload = {
//                            ss: "1",
//                            msg: {
//                                netsMid: data.msg.netsMid,
//                                merchantTxnRef: merchantTxnRef,
//                                netsTxnStatus: txnStatus,
//                                netsTxnMsg: data.msg.netsTxnMsg,
//                                netsTxnRef: netsTxnRef,
//                                netsTxnDtm: data.msg.netsTxnDtm,
//                                netsAmountDeducted: netsAmountDeducted,
//                                paymentMode: data.msg.paymentMode,
//                                bankRefCode: data.msg.bankRefCode,
//                                netsMidIndicator: netsMidIndicator
//                            }
//                        };
//                        sessionStorage.setItem("Payload", JSON.stringify(fullPayload));
//                        const form = document.createElement("form");
//                        form.method = "POST";
//                        form.action = "/SR/Return";

//                        const input = document.createElement("input");
//                        input.type = "hidden";
//                        input.name = "message";
//                        input.value = JSON.stringify(fullPayload);  // ✅ Only stringify once

//                        form.appendChild(input);
//                        document.body.appendChild(form);
//                        form.submit();

//                    }
//                     else {
//                        retryCount++;
//                        if (retryCount < maxRetries) {
//                            setTimeout(doFallbackQuery, retryInterval);
//                        } else {
//                            console.warn(`[Fallback] Max retry attempts reached for ${merchantTxnRef}`);
//                            window.location.href = "/SecretRecipe/Payment";
//                        }
//                    }
//                })
//                .catch(error => {
//                    console.error("❌ Error during fallback query:", error);
//                    retryCount++;
//                    if (retryCount < maxRetries) {
//                        setTimeout(doFallbackQuery, retryInterval);
//                    } else {
//                       window.location.href = "/SecretRecipe/Payment";
//                    }
//                });
//        }
//        doFallbackQuery();


//    }, 10000);

//    if ('tsStatus' in objStr) {
//        tsStatus = objStr.tsStatus;
//    }

//    if ('tsIntMsg' in objStr) {
//        tsIntMsg = objStr.tsIntMsg;
//    }

//    if ('tsMerchMsg' in objStr) {
//        tsMerchMsg = objStr.tsMerchMsg;
//    }

//    //creditcard
//    gexp = objStr.rsaExponent;
//    gmod = objStr.rsaModulus;

//    console.log(gexp);
//    if (typeof isHostedPage !== undefined && isHostedPage == true) {
//        if ($("#netsTxnRef").length) {
//            $("#netsTxnRef").text(netsTxnRef);
//        }
//    }

//    /*
//     * alert("[APPS.JS] selectedService is: " + selectedService);
//     * alert("[APPS.JS] routeTo is: " + routeTo) alert("[APPS.JS] netsMid is: " +
//     * netsMid)
//     */

//    // if undefined, it will indicate that it is an error response from FE
//    /*
//     * if(typeof objStr.merchSubscribedSvcs === "undefined") {
//     * $("#ajaxResponse").append("TRANSACTION CANNOT PROCEED, PLEASE QUOTE ERROR
//     * CODE="); $("#ajaxResponse").append(objStr.netsTxnRespCode); }
//     */
//    var tsReqFlag = null;
//    var selectedTokenServ = selectTokenServiceForTxn(objStr.paymtSvcInfoList);

//    if (selectedTokenServ != null && selectedTokenServ != "NOCVV" && selectedTokenServ != "TSERROR") {
//        tsReqFlag = 1;
//    }
//    else if (selectedTokenServ != null && selectedTokenServ == "NOCVV" && selectedTokenServ != "TSERROR") {
//        tsReqFlag = 4;
//    }
//    else if (selectedTokenServ != null && selectedTokenServ == "TSERROR") {
//        tsReqFlag = 3;
//    }

//    var noOfServ = objStr.merchantSvcList.length;
//    console.log("objStr is:" + objStr);
//    console.log(" no of services " + objStr.merchantSvcList.length);
//    console.log("tsReqFlag is: " + tsReqFlag + "For: " + selectedTokenServ);
//    var onlyCCService = true;
//    //var onlyCCService = false;
//    var ccSNo = 0;
//    // take into consideration if service list is only APS (though service list
//    // is more than 1 due to subservices),
//    // number of services should always be 1
//    if (objStr.onlyAPSFlag == 'T') {
//        noOfServ = 1;
//    }
//    else {
//        onlyCCService = true;
//        for (i = 0; i < objStr.merchantSvcList.length; i++) {
//            if (objStr.merchantSvcList[i].indexOf("CC_") == -1) {
//                onlyCCService = false;
//            }
//        }
//        console.log("onlyCCService : " + onlyCCService);
//        console.log("objStr.currencyCode" + objStr.currencyCode);
//        for (i = 0; i < objStr.merchantSvcList.length; i++) {
//            if ((objStr.merchantSvcList[i].indexOf("CC_") != -1) && (objStr.merchantSvcList[i].indexOf("AMEX") == -1)) {
//                // UMID will not contain multiple currency credit
//                //ccSNo = 1;
//                ccSNo = ccSNo + 1;
//                console.log("ccSNO : " + ccSNo);
//            }
//            if (objStr.merchantSvcList[i].indexOf("AMEX") != -1) {
//                //contains amex
//                ccSNo = ccSNo + 2;
//                console.log("ccSNO : " + ccSNo);
//            }
//        }
//        if (onlyCCService) {
//            noOfServ = 1;
//        }
//    }


//    if (!jQuery.isEmptyObject(objStr.walletSvcList)) {
//        noOfServ = 2;
//    }

//    // alert("[APPS.JS] noOfServ is= " + noOfServ);

//    // testing codes - to test out 1 service only
//    // noOfServ = 1;
//    // serviceName = 'APS_SGD_NETS2.0';
//    // routeTo = 'FEH';

//    // noOfServ = 1 if bypassing the OnePagePage
//    // selectedsERVICE != '' if invoked from onePage and selected a service
//    if (noOfServ == 1 || selectedService != null) {
//        var serviceName;

//        // if byPass OnePager, get from merchantSvcList
//        if (noOfServ == 1) {
//            serviceName = objStr.merchantSvcList[0];
//            routeTo = objStr.routeTo;
//            //netsMid = objStr.paymtSvcInfoList[0].netsMid;
//            if (onlyCCService && objStr.onlyAPSFlag != 'T') {
//                serviceName = "CC_" + ccSNo;
//            }
//        } else { // if from OnePager
//            serviceName = selectedService;
//        }

//        // alert("[APPS.JS] service name is: " + serviceName);

//        if (serviceName == 'UPOP_SGD') {

//            if (routeTo == 'FEH') {

//                alert("[APPS.JS] this is UPOP");
//                // making REST call now
//                // create the JSON request to send 2nd request (via Consumer
//                // browser) to FE
//                var payRequest2 = '{"txnRand":"'
//                    + objStr.txnRand
//                    + '","submissionMode":"B","paymentMode":"UPOP","netsTxnRef":"'
//                    + objStr.netsTxnRef + '","netsMid":"' + netsMid + '"}';

//                $.ajax({
//                    type: "POST",
//                    url: gwdomain + "/GW2/processUpopFrontEnd",
//                    contentType: contentTypeVal,
//                    cache: false,
//                    dataType: "html",
//                    data: payRequest2,

//                    success: function (data, textStatus, jqXHR) {
//                        $("#ajaxResponse").html("");
//                        $("#ajaxResponse").append(data);
//                        alert("Successful");
//                        alert("Data to send to UPOP is: " + data);
//                    },
//                    error: function (jqXHR, textStatus, errorThrown) {
//                        alert("Error Encountered");
//                        $("#ajaxResponse").html("");
//                        $("#ajaxResponse").append("ERROR ENCOUNTERED");
//                    }
//                });
//            } // reserve for other routing operations (e.g. DISTRA)
//        } else if ('CC' == serviceName.slice(0, 2)) {
//            // alert("This is CC");
//            console.log("selected service=" + selectedService);
//            if (selectedService == 'CC_MP') {
//                console.log("Incoming MasterPass transaction");

//                $(function () { // when DOM is ready
//                    // alert("DOM is ready ");
//                    // $("#ajaxResponse").load(
//                    // "https://sit2.enets.sg/GW2/credit/init"); // load the
//                    // sample.jsp page in the #chkcomments element

//                    $.post(gwdomain + "/GW2/creditFEH/redirectMasterPass", {
//                        txnRand: objStr.txnRand, netsMid: objStr.netsMid, routeTo: routeTo
//                    }, function (data, status) {
//                        // alert("Data: " + data + "\nStatus: " + status);
//                        console.log("Data received : " + status)
//                        console.log(data);
//                        //	$("#anotherSection").empty().append(data);
//                        $("#ajaxResponse").empty().append(data);
//                    });
//                });

//            } else {
//                console.log("in credit mode",objStr);
//                var expYear = "";
//                var expMonth = "";
//                if (objStr.expiryDate != null) {
//                    expYear = objStr.expiryDate.substring(0, 2);
//                    expMonth = objStr.expiryDate.substring(2, 4);
//                }

//                var paymentModeSelected = "CC";
//                if (serviceName.indexOf("AMEX") != -1) {
//                    paymentModeSelected = "CA";
//                }
//                $(function () { // when DOM is ready
//                    // alert("DOM is ready ");
//                    // $("#ajaxResponse").load(
//                    // "https://sit2.enets.sg/GW2/credit/init"); // load the
//                    // sample.jsp page in the #chkcomments element

//                    $.post("/SR/PostCreditInit", {
//                        txnRand: objStr.txnRand,
//                        paymentMode: serviceName,
//                        routeTo: routeTo,
//                        selectedTokenService: selectedTokenServ,
//                        tsTxnReqFlag: tsReqFlag,
//                        cardHolderName: objStr.cardHolderName,
//                        consumerEmail: objStr.consumerEmail,
//                        maskPan: objStr.maskPan,
//                        expiryMonth: expMonth,
//                        expiryYear: expYear,
//                        tsProcessingCode: objStr.tsProcessingCode,
//                        tsStatus: tsStatus,
//                        tsIntMsg: tsIntMsg,
//                        tsMerchMsg: tsMerchMsg,
//                    }, function (data, status) {
//                        // alert("Data: " + data + "\nStatus: " + status);
//                        console.log("Data received : " + status)
//                        console.log(data);
//                        //	$("#anotherSection").empty().append(data);
//                        $("#ajaxResponse").empty().append(data);
//                    });
//                });
//            }
//        } else if (serviceName == 'DD') {
//            // do something here
//            //222
//            // Assume gwdomain and objStr are already defined
//            let payload = {
//                txnRand: objStr.txnRand,
//                paymentMode: "DD"
//            };

//            $.ajax({
//                type: "POST",
//                url: "/SR/PostDebitInit",
//                contentType: "application/x-www-form-urlencoded",
//                dataType: "html",
//                data: payload, // your key1=value1&key2=value2 string
//                success: function (data) {
//                    const parser = new DOMParser();
//                    const parsedDoc = parser.parseFromString(data, 'text/html');

//                    // Inject only the body content
//                    const bodyContent = parsedDoc.body.innerHTML;
//                    $('#ajaxResponse').html(bodyContent);

//                    // Re-execute scripts safely
//                    const scripts = parsedDoc.querySelectorAll("script");
//                    scripts.forEach((script) => {
//                        const newScript = document.createElement("script");

//                        if (script.src) {
//                            // External JS
//                            newScript.src = script.src;
//                        } else {
//                            // Inline JS
//                            newScript.textContent = script.textContent;
//                        }

//                        document.body.appendChild(newScript);
//                    });
//                    console.log("Injected content and scripts executed.");
//                },
//                error: function () {
//                    console.error("Error loading eNETS response");
//                    writeErrorInfo("0010-50003", "1");
//                }
//            });



//            //Note: The startsWith() method is not supported in IE 11 (and earlier versions).
//        } else if (serviceName.indexOf('APS_SGD') == 0) {
//            //	alert('this is APS_SGD');
//            //		netsMid = '987669250'; // GARED for testing
//            //		txnRand = objStr.txnRand;
//            //		netsTxnRef = objStr.netsTxnRef;
//            //		netsMidGlobal = netsMid;
//            //		merchantTxnRef = objStr.merchantTxnRef;
//            //		b2sTxnEndURL = objStr.b2sTxnEndURL;
//            var apsRequest = '{"ss":"1","msg":{"txnRand":"' + txnRand + '","netsTxnRef":"' + netsTxnRef + '","netsMid":"' + objStr.netsMid + '","netsMidIndicator":"' + netsMidIndicator +'","paymentMode":"QR"}}';
//            if (routeTo == 'FEH') {
//                var isCountinueDbCheck = true;
//                // get the APS QR Data
//                $.ajax({
//                    type: "POST",
//                    url: "/SR/PostPaymentQR",
//                    contentType: contentTypeVal,
//                    dataType: "json",
//                    data: apsRequest,
//                    success: function (data, textStatus, jqXHR) {
//                        var objStr = jQuery.parseJSON(JSON.stringify(data));
//                        var objMsgStr = jQuery.parseJSON(JSON.stringify(objStr.msg));
//                        console.log("objMsgStr", objMsgStr.qrData);

//                        if (jQuery.isEmptyObject(objMsgStr.qrData)) {

//                            //$("#ajaxResponse").html("");
//                            if (!jQuery.isEmptyObject(objMsgStr.stageRespCode)) {
//                                // alert(objMsgStr.hmac);
//                                // processErrorPage(jSonString,objMsgStr.stageRespCode,objMsgStr.actionCode,objMsgStr.netsTxnMsg);
//                                if (!jQuery.isEmptyObject(objMsgStr.hmac) && !jQuery.isEmptyObject(objMsgStr.rawMsg)) {
//                                    processErrorPage(JSON.stringify(objMsgStr), null, null, null);
//                                } else {
//                                    writeErrorInfo(objMsgStr.stageRespCode, objMsgStr.actionCode);
//                                }
//                            } else {
//                                // This should not be possible as it
//                                // will always send stage response code
//                                $("#ajaxResponse").append(objMsgStr.netsTxnMsg);
//                            }
//                        } else {
//                            // display the APS QR Page
//                            $.ajax({
//                                type: "POST",
//                                url: "/SR/DisplayQRpage/?serviceName=" + serviceName,
//                                contentType: contentTypeVal,
//                                cache: false,
//                                dataType: "html",
//                                data: objMsgStr.qrData,
//                                success: function (data) {
//                                    let agentStopIndicator = "0";
//                                    $("#ajaxResponse").html(data);
//                                    $(".col-xs-12.col-sm-7.col-md-8.col-lg-8").hide();
//                                    const intialApsQryCount = 3;
//                                    const finalApsQryCount = 5;
//                                    const intApsQryDuration = 60000; // 60 seconds
//                                    const MAX_TOTAL_RETRIES = intialApsQryCount + finalApsQryCount;

//                                    let totalRetryCounter = 0;
//                                    let retryCount = 0;
//                                    let firstRetryTimer = null;
//                                    let secondRetryTimer = null;

//                                    const apsQuery = JSON.stringify({
//                                        ss: "1",
//                                        msg: {
//                                            txnRand: txnRand,
//                                            netsTxnRef: netsTxnRef,
//                                            b2sTxnEndURL: b2sTxnEndURL,
//                                            paymentMode: "QR",
//                                            merchantTxnRef: merchantTxnRef
//                                        }
//                                    });


//                                    ApsQueryFnc = function () {
//                                        $.ajax({
//                                            type: "POST",
//                                            url: "/SR/doApsQuery",
//                                            contentType: contentTypeVal,
//                                            cache: false,
//                                            dataType: "html",
//                                            data: apsQuery,
//                                            success: function (data) {
//                                                retryCount++;
//                                                const apsActionCode = $(data).find("#apsActionCode").val();
//                                                msgRefId = $(data).find("#msgRefId").val();
//                                                netsMidGlobal = $(data).find("#netsMid").val();

//                                                if (apsActionCode === 'ap01.05') {
//                                                    console.log("apsActionCode ap01.05, retryCount: ", retryCount);

//                                                    if (retryCount === 1) {
//                                                        let firstRetryCount = 0;

//                                                        firstRetryTimer = setInterval(() => {
//                                                            firstRetryCount++;
//                                                            totalRetryCounter++;
//                                                            console.log(`FirstRetryCount: ${firstRetryCount}, Total: ${totalRetryCounter}`);

//                                                            ApsQueryStat();

//                                                            if (firstRetryCount >= intialApsQryCount) {
//                                                                clearInterval(firstRetryTimer);
//                                                                ApsQueryFnc(); // retry doApsQuery again
//                                                            }

//                                                            if (totalRetryCounter >= MAX_TOTAL_RETRIES) {
//                                                                clearInterval(firstRetryTimer);
//                                                                $("#ajaxResponse").html("<div style='color:red;'>QR expired. Please refresh to try again.</div>");
//                                                            }
//                                                        }, intApsQryDuration);

//                                                    } else {
//                                                        let secondRetryCount = 0;

//                                                        secondRetryTimer = setInterval(() => {
//                                                            secondRetryCount++;
//                                                            totalRetryCounter++;
//                                                            console.log(`SecondRetryCount: ${secondRetryCount}, Total: ${totalRetryCounter}`);

//                                                            ApsQueryStat();

//                                                            if (secondRetryCount >= finalApsQryCount) {
//                                                                clearInterval(secondRetryTimer);
//                                                                ApsQueryFnc(); // retry doApsQuery again
//                                                            }

//                                                            if (totalRetryCounter >= MAX_TOTAL_RETRIES) {
//                                                                clearInterval(secondRetryTimer);
//                                                                $("#ajaxResponse").html("<div style='color:red;'>QR expired. Please refresh to try again.</div>");
//                                                            }
//                                                        }, intApsQryDuration);
//                                                    }
//                                                }
//                                            }
//                                        });
//                                    };

//                                    ApsQueryStat = function () {
//                                        $.ajax({
//                                            type: "POST",
//                                            url: "/SR/DoInternalApsQuery",
//                                            contentType: contentTypeVal,
//                                            cache: false,
//                                            dataType: "html",
//                                            data: apsQuery,
//                                            headers: { "msgRefId": msgRefId },
//                                            success: function (data) {
//                                                const apsStageRespCode = $(data).find("#apsStageRespCode").val();
//                                                const apsActionCode = $(data).find("#apsActionCode").val();

//                                                console.log("DoInternalApsQuery Success:", apsStageRespCode, apsActionCode);

//                                                if (apsStageRespCode === '3000-00000') {
//                                                    clearInterval(firstRetryTimer);
//                                                    clearInterval(secondRetryTimer);
//                                                    $("#ajaxResponse").html(data);
//                                                } else if (
//                                                    apsStageRespCode === '0050-50002' ||
//                                                    apsStageRespCode === '0050-50003'
//                                                ) {
//                                                    clearInterval(firstRetryTimer);
//                                                    clearInterval(secondRetryTimer);
//                                                    writeErrorInfo(apsStageRespCode, apsActionCode);
//                                                }
//                                            },
//                                            error: function (jqXHR) {
//                                                if (jqXHR.status === 504) {
//                                                    console.warn("Timeout on DoInternalApsQuery. Continuing retries.");
//                                                }
//                                            }
//                                        });
//                                    };

//                                    // Start query loop
//                                    ApsQueryFnc();

//                                },
//                                error: function (jqXHR, textStatus, errorThrown) {
//                                    // This should not be possible as it will always
//                                    // send stage response code
//                                    if (jqXHR.status == 404) {
//                                        writeErrorInfo('0030-50002', '1');
//                                    } else { // if not 200 should be a set-up
//                                        // error
//                                        $("#ajaxResponse").html("");
//                                        $("#ajaxResponse").append("<b>INTERNAL SYSTEM ERROR ON APS QR DATA</b>");
//                                    }
//                                }
//                            });
//                        }
//                    },
//                    error: function (jqXHR, textStatus, errorThrown) {
//                        // This should not be possible as it will always send stage response code
//                        if (jqXHR.status == 404) {
//                            writeErrorInfo('0030-50002', '1');
//                        } else { // if not 200 should be a set-up error
//                            $("#ajaxResponse").html("");
//                            $("#ajaxResponse").append("<b>INTERNAL SYSTEM ERROR ON APS QR DATA</b>");
//                        }
//                    }
//                });
//            }
//        }
//        else if (serviceName.slice(0, 3) == "IPP") {
//            $(function () {
//                $.post(gwdomain + "/GW2/credit/init", {
//                    txnRand: objStr.txnRand,
//                    paymentMode: serviceName,
//                    routeTo: routeTo,
//                }, function (data, status) {
//                    // alert("Data: " + data + "\nStatus: " + status);
//                    console.log("Data received : " + status)
//                    console.log(data);
//                    //	$("#anotherSection").empty().append(data);
//                    $("#ajaxResponse").empty().append(data);
//                });
//            });
//        }


//    } else {
//        $.ajax({
//            type: "POST",
//            url: "/SR/PrepareOnePager",
//            contentType: "application/json",
//            cache: false,
//            dataType: "html", // expecting full HTML
//            data: jSonString,
//            success: function (data) {
//                // Use DOMParser instead of jQuery to safely parse full HTML
//                const parser = new DOMParser();
//                const parsedDoc = parser.parseFromString(data, 'text/html');

//                // Extract just the body content
//                const bodyContent = parsedDoc.body.innerHTML;

//                // Optional: remove script tags if needed
//                const tempDiv = document.createElement('div');
//                tempDiv.innerHTML = bodyContent;

//                // Remove specific external scripts if needed
//                const scripts = tempDiv.querySelectorAll('script[src*="apps.js"]');
//                scripts.forEach(s => s.remove());

//                // Inject into your target div
//                document.getElementById('ajaxResponse').innerHTML = tempDiv.innerHTML;
//            },
//            error: function () {
//                writeErrorInfo("0010-50002", "1");
//            }
//        });


//    }
//}





function GetSessionFromPOS() {
    $.ajax({
        url: '/SR/GetPOSSession',
        type: 'GET',
        contentType: 'application/json',
        dataType: 'text',
        success: function (data) {
            const outer = JSON.parse(data);
            const inner = JSON.parse(outer.sessionID);
            const sessionId = inner.data[0].output[0].session_id;

            $.ajax({
                url: `/SR/GetPOSOutletLocation?sessionId=${sessionId}`,
                type: 'GET',
                contentType: 'application/json',
                dataType: 'text',
                success: function (data) {
                    const outletResponse = JSON.parse(data);

                    // Parse the inner string (again)
                    const parsedData = JSON.parse(outletResponse.data);

                    if (parsedData && parsedData.data && parsedData.data.length > 0) {
                        parsedData.data.forEach(dataItem => {
                            if (dataItem.output && dataItem.output.length > 0) {
                                dataItem.output.forEach(store => {
                                    console.log("Store Name:", store.store_name);
                                });
                            }
                        });
                    } else {
                        console.error("Parsed data missing expected structure:", parsedData);
                    }
                },
                error: function (xhr) {
                    console.error("GetPOSOutletLocation failed:", xhr.responseText);
                }
            });
        },
        error: function (xhr) {
            console.error("GetPOSSession failed:", xhr.responseText);
        }
    });
}



function logOut() {
    $.ajax({
        url: '/SR/Logout',
        type: 'POST',
        success: function () {
            localStorage.setItem("LoggedIn", false);
            window.location.href = '/SecretRecipe/Login';
        },
        error: function (xhr) {
            console.error("Logout failed:", xhr.responseText);
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    const currentPage = (document.body.getAttribute("data-page") || "").toLowerCase();
    const isCheckoutOrPaymentPage = currentPage === "checkout" || currentPage === "payment";

    if (!isCheckoutOrPaymentPage) {

        // Announcement Bar
        document.getElementById('announcement_bar_0').innerHTML = `
        For same day delivery please call our outlets : 
         <a style="text-decoration: none; color: white; padding-left: 5px;"> ☎ Toa Payoh 6250 6523 </a>
         <a style="text-decoration: none; color: white; padding-left: 5px;"> ☎ Plaza Singapura 6341 9909 </a>
        <input type="hidden" id="expired_at_0" name="expired_at_0" value="2020-08-06 00:00">`;

        // Prevent duplicate header loading
        if (document.getElementById("easystore-header-loaded")) return;
        const marker = document.createElement('div');
        marker.id = "easystore-header-loaded";
        document.body.appendChild(marker);

        // Main Header HTML Injection
        document.getElementById("easystore-section-header").innerHTML += `
        <sticky-header class="header-wrapper header-wrapper--border-bottom">
        <div id="desktop_logo">
            <a href="/">
              <img src="https://cdn.store-assets.com/s/896/f/10594755.png" alt="Secret Recipe" style="width:214px;">
            </a>
          </div>
          <header class="header header--middle-left page-width header--has-menu">
    
            <header-drawer data-breakpoint="tablet">
              <details class="menu-drawer-container menu-opening">
                <summary class="header__icon header__icon--menu header__icon--summary link link--text focus-inset" aria-label="Menu" role="button" aria-expanded="true" aria-controls="menu-drawer">
                  <span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-hamburger" fill="none" viewBox="0 0 18 16">
                      <path d="M1 .5a.5.5 0 100 1h15.71a.5.5 0 000-1H1zM.5 8a.5.5 0 01.5-.5h15.71a.5.5 0 010 1H1A.5.5 0 01.5 8zm0 7a.5.5 0 01.5-.5h15.71a.5.5 0 010 1H1a.5.5 0 01-.5-.5z" fill="currentColor"></path>
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-close" fill="none" viewBox="0 0 18 17">
                      <path d="M.865 15.978a.5.5 0 00.707.707l7.433-7.431 7.579 7.282a.501.501 0 00.846-.37.5.5 0 00-.153-.351L9.712 8.546l7.417-7.416a.5.5 0 10-.707-.708L8.991 7.853 1.413.573a.5.5 0 10-.693.72l7.563 7.268-7.418 7.417z" fill="currentColor"></path>
                    </svg>
                  </span>
                </summary>
                <div id="menu-drawer" class="menu-drawer motion-reduce" tabindex="-1">
                  <div class="menu-drawer__inner-container">
                    <div class="menu-drawer__navigation-container">
                      <nav class="header__inline-menu1">
                        <ul class="list-menu list-menu--inline" role="list">
                          <li><a href="/" class="header__menu-item list-menu__item link link--text focus-inset">Home</a></li>
                          <li class="menu">
                            <a class="header__menu-item list-menu__item link link--text focus-inset dropdown-toggle" id="dropdown-btn">CAKES</a>
                              <div class="dropdown-content" id="dropdown-menu">
                                <div class="dropdown-section" id="dropdownCakes1">
                                </div>
                              </div>
                          </li> 
                          <li class="menu" style="display: none;">
                            <a class="header__menu-item list-menu__item link link--text focus-inset dropdown-toggle" id="dropdown-btn1" >OTHERS</a>
                               <div class="dropdown-content" id="dropdown-menu1" style="display: none;">
                                    <div class="dropdown-section" id="otherDropMenu">
                               </div>
                          </li>
                          <li><a href="/SecretRecipe/Menu" class="header__menu-item list-menu__item link link--text focus-inset">Café Menu</a></li>
                     
                          <li><a href="/SecretRecipe/Outlets" class="header__menu-item list-menu__item link link--text focus-inset">Find us</a></li>
                        </ul>
                      </nav>
                      <div class="menu-drawer__utility-links" style="display:none;">
                        <a href="/SecretRecipe/Login" class="menu-drawer__account link link--text focus-inset h5">
                          <svg class="icon icon-account" fill="none" viewBox="0 0 18 19">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M6 4.5a3 3 0 116 0 3 3 0 01-6 0zm3-4a4 4 0 100 8 4 4 0 000-8zm5.58 12.15c1.12.82 1.83 2.24 1.91 4.85H1.51c.08-2.6.79-4.03 1.9-4.85C4.66 11.75 6.5 11.5 9 11.5s4.35.26 5.58 1.15z" fill="currentColor"/>
                          </svg>
                          Log in
                        </a>
                    
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </header-drawer>

            <a href="/" class="header__heading-link link link--text focus-inset mobile-logo">
              <img src="https://cdn.store-assets.com/s/896/f/10594755.png" class="header__heading-logo" alt="Secret Recipe" loading="lazy">
            </a>

            <nav class="header__inline-menu">
              <ul class="list-menu list-menu--inline" role="list">
                <li><a href="/" class="header__menu-item list-menu__item link link--text focus-inset">Home</a></li>
                <li class="menu">
                  <a href="#" class="header__menu-item list-menu__item link link--text focus-inset">Cakes</a>
                  <svg xmlns="http://www.w3.org/2000/svg"
                         width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.23 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
                    </svg>
                  <div class="dropdown">
                    <div class="dropdown-content" id="dropdown-menu">
                      <div class="dropdown-section" id="dropdownCakes"></div>
                  
                    </div>
                  </div>
                </li>
                <li class="menu" style="display: none;">
                  <a href="#" class="header__menu-item list-menu__item link link--text focus-inset" >Others</a>
                  <svg xmlns="http://www.w3.org/2000/svg"
                     width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                     <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.23 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
                  </svg>
                  <div class="dropdown">
                    <div class="dropdown-content" id="dropdown-menu">
                      <div class="dropdown-section" id="otherDropMenu1">
                    </div>
                  </div>
                </li>
                <li><a href="/SecretRecipe/Menu" class="header__menu-item list-menu__item link link--text focus-inset">Café Menu</a></li>
    
           
                <li><a href="/SecretRecipe/Outlets" class="header__menu-item list-menu__item link link--text focus-inset">FInd Us</a></li>
              </ul>
            </nav>

        
             <div class="header__icons">
                       
                            <div class="header__icon header__icon--account link link--text focus-inset small-hide medium-hide" id="LoginMenuLink">
                                <a href="/SecretRecipe/Login" class="header__icon link link--text focus-inset p-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" role="presentation" class="icon icon-account " fill="none" viewBox="0 0 18 19">
                                        <path fill-rule="evenodd" clip-rule="evenodd" d="M6 4.5a3 3 0 116 0 3 3 0 01-6 0zm3-4a4 4 0 100 8 4 4 0 000-8zm5.58 12.15c1.12.82 1.83 2.24 1.91 4.85H1.51c.08-2.6.79-4.03 1.9-4.85C4.66 11.75 6.5 11.5 9 11.5s4.35.26 5.58 1.15zM9 10.5c-2.5 0-4.65.24-6.17 1.35C1.27 12.98.5 14.93.5 18v.5h17V18c0-3.07-.77-5.02-2.33-6.15-1.52-1.1-3.67-1.35-6.17-1.35z"
                                              fill="currentColor"></path>
                                    </svg>
                                </a>
                            </div>
                            <div class="header__icon header__icon--account link link--text focus-inset small-hide medium-hide" id="profileMenuLink">
                              <li class="menu" style="list-style: none;" >
                                 <a class="header__menu-item list-menu__item link link--text focus-inset" aria-haspopup="true" aria-expanded="false" aria-controls="profileDropdownMenu">
                                     <!-- PROFILE ICON -->
                                     <svg xmlns="http://www.w3.org/2000/svg"
                                          aria-hidden="true"
                                          focusable="false"
                                          role="img"
                                          class="icon icon-account"
                                          width="21" height="21"
                                          viewBox="0 0 18 19"
                                          fill="none"
                                          style="vertical-align: middle;">
                                         <path fill-rule="evenodd" clip-rule="evenodd"
                                               d="M6 4.5a3 3 0 116 0 3 3 0 01-6 0zm3-4a4 4 0 100 8 4 4 0 000-8zm5.58 12.15c1.12.82 1.83 2.24 1.91 4.85H1.51c.08-2.6.79-4.03 1.9-4.85C4.66 11.75 6.5 11.5 9 11.5s4.35.26 5.58 1.15zM9 10.5c-2.5 0-4.65.24-6.17 1.35C1.27 12.98.5 14.93.5 18v.5h17V18c0-3.07-.77-5.02-2.33-6.15-1.52-1.1-3.67-1.35-6.17-1.35z"
                                               fill="currentColor"></path>
                                     </svg>
                                 </a>
                                 <div class="dropdown" id="profileDropDown">
                                     <div class="dropdown-content" id="profileDropdownMenu" role="menu" aria-labelledby="profileMenuLink">
                                         <div class="dropdown-section" id="dropdownAccount">
                                             <a href="/SecretRecipe/Profile" role="menuitem">My Profile</a>
                                             <a role="menuitem" onclick="logOut()">Logout</a>
                                         </div>
                                     </div>
                                 </div>
                     </li> </div>
                    <a href="/SecretRecipe/Cart" class="header__icon header__icon--cart link link--text focus-inset" id="cart-icon-bubble">
                        <svg class="icon icon-cart-empty " aria-hidden="true" focusable="false" role="presentation" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">
                            <path d="m15.75 11.8h-3.16l-.77 11.6a5 5 0 0 0 4.99 5.34h7.38a5 5 0 0 0 4.99-5.33l-.78-11.61zm0 1h-2.22l-.71 10.67a4 4 0 0 0 3.99 4.27h7.38a4 4 0 0 0 4-4.27l-.72-10.67h-2.22v.63a4.75 4.75 0 1 1 -9.5 0zm8.5 0h-7.5v.63a3.75 3.75 0 1 0 7.5 0z" fill="currentColor"
                                  fill-rule="evenodd"></path>
                        </svg>
                        <div class="cart-count-bubble hidden">
                            <span aria-hidden="true" class="js-content-cart-count" id="js-content-cart-count">0</span>
                        </div>
                    </a>
                </div>
          </header>
     
        </sticky-header>
     
        <cart-notification>
                <div class="cart-notification-wrapper page-width color-background-1">
                    <div id="cart-notification" class="cart-notification focus-inset" aria-modal="true" aria-label="Added to cart" role="dialog" tabindex="-1">
                        <div class="cart-notification__header">
                            <h2 class="cart-notification__heading caption-large">
                                <svg class="icon icon-checkmark color-foreground-text " aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 9" fill="none">
                                    <path fill-rule="evenodd" clip-rule="evenodd" d="M11.35.643a.5.5 0 01.006.707l-6.77 6.886a.5.5 0 01-.719-.006L.638 4.845a.5.5 0 11.724-.69l2.872 3.011 6.41-6.517a.5.5 0 01.707-.006h-.001z" fill="currentColor"></path>
                                </svg>
                                Added to cart
                            </h2>
                            <button type="button" class="cart-notification__close modal__close-button link link--text focus-inset" aria-label="accessibility.close" onclick="document.getElementById('cart-notification').style.display = 'none';">
                                <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" role="presentation" class="icon icon-close " fill="none" viewBox="0 0 18 17">
                                    <path d="M.865 15.978a.5.5 0 00.707.707l7.433-7.431 7.579 7.282a.501.501 0 00.846-.37.5.5 0 00-.153-.351L9.712 8.546l7.417-7.416a.5.5 0 10-.707-.708L8.991 7.853 1.413.573a.5.5 0 10-.693.72l7.563 7.268-7.418 7.417z" fill="currentColor">
                                    </path>
                                </svg>
                            </button>

                        </div>
                        <div id="cart-notification-product" class="cart-notification-product"></div>
                   
                    </div>
                </div>
        </cart-notification>`;

        // Profile/Login Link Visibility Logic
        const profileLink = document.getElementById("profileMenuLink");
        const loginLink = document.getElementById("LoginMenuLink");

        if (localStorage.getItem("LoggedIn") === "true") {
            console.log("true");
            if (profileLink) profileLink.style.display = "block";
            if (loginLink) loginLink.style.display = "none";
        } else {
            console.log("false");
            if (profileLink) profileLink.style.display = "none";
            //if (loginLink) loginLink.style.display = "block";
        }
        loginLink.style.display = "none";

        // WhatsApp Floating Button
        (function () {
            // Create <style> tag with responsive CSS
            const style = document.createElement('style');
            style.textContent = `
                .whatsapp-button {
                  position: fixed;
                  bottom: 20px;
                  right: 20px;
                  width: 60px;
                  height: 60px;
                  background-color: #25d366;
                  border-radius: 50%;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                  cursor: pointer;
                  z-index: 9999;
                  transition: background-color 0.3s ease;
                }
                .whatsapp-button img {
                  width: 30px;
                  height: 30px;
                }
                .whatsapp-button:hover {
                  background-color: #1ebd5a;
                }
              `;
            document.head.appendChild(style);

            // Create WhatsApp button
            const waButton = document.createElement('div');
            waButton.className = 'whatsapp-button';

            // Create icon image
            const waImg = document.createElement('img');
            waImg.src = 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg';
            waImg.alt = 'WhatsApp Logo';

            // Append image to button
            waButton.appendChild(waImg);

            // Open WhatsApp on click (replace number)
            waButton.onclick = function () {
                const message = encodeURIComponent("Hi there! I'd like to know more about your cake ordering options.");
                window.open(`https://wa.me/6591063726?text=${message}`, '_blank');
            };

            // Add to body
            document.body.appendChild(waButton);
        })();

        // Load dropdown menu items
        GetDropDownMenu();

        // ============================================
        // MOBILE DROPDOWN TOGGLE FUNCTIONALITY
        // ============================================
        setTimeout(function () {
            console.log('🔧 Initializing mobile dropdown...');

            // Mobile CAKES dropdown
            const mobileDropdownBtn = document.getElementById('dropdown-btn');
            const mobileDropdownMenu = document.querySelector('.header__inline-menu1 #dropdown-menu');

            if (mobileDropdownBtn && mobileDropdownMenu) {
                mobileDropdownBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    console.log('📱 Mobile CAKES dropdown clicked');

                    // Toggle the 'show' class
                    mobileDropdownMenu.classList.toggle('show');

                    // Toggle active class on button
                    mobileDropdownBtn.classList.toggle('active');

                    // Log current state
                    const isOpen = mobileDropdownMenu.classList.contains('show');
                    console.log('Dropdown is now:', isOpen ? 'OPEN ✅' : 'CLOSED ❌');
                });

                console.log('✅ Mobile CAKES dropdown initialized successfully');
            } else {
                console.error('❌ Mobile dropdown elements not found:', {
                    button: !!mobileDropdownBtn,
                    menu: !!mobileDropdownMenu
                });
            }

            // Mobile OTHERS dropdown (currently hidden, enable when needed)
            const mobileDropdownBtn1 = document.getElementById('dropdown-btn1');
            const mobileDropdownMenu1 = document.getElementById('dropdown-menu1');

            if (mobileDropdownBtn1 && mobileDropdownMenu1) {
                mobileDropdownBtn1.addEventListener('click', function (e) {
                    e.preventDefault();
                    console.log('📱 Mobile OTHERS dropdown clicked');

                    // Toggle the 'show' class
                    mobileDropdownMenu1.classList.toggle('show');

                    // Toggle active class on button
                    mobileDropdownBtn1.classList.toggle('active');
                });

                console.log('✅ Mobile OTHERS dropdown initialized successfully');
            }

        }, 100); // Small delay ensures DOM elements are ready

    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// Optional: Function to close all mobile dropdowns
function closeAllMobileDropdowns() {
    const dropdowns = document.querySelectorAll('.header__inline-menu1 .dropdown-content');
    const buttons = document.querySelectorAll('.header__inline-menu1 .header__menu-item');

    dropdowns.forEach(function (dropdown) {
        dropdown.classList.remove('show');
    });

    buttons.forEach(function (button) {
        button.classList.remove('active');
    });
}

// Optional: Close mobile dropdowns when clicking outside
document.addEventListener('click', function (e) {
    // Only run on mobile devices
    if (window.innerWidth <= 900) {
        // Check if click was outside mobile menu
        if (!e.target.closest('.header__inline-menu1 .menu')) {
            closeAllMobileDropdowns();
        }
    }
});

document.addEventListener("DOMContentLoaded", function () {
    const currentPage = (document.body.getAttribute("data-page") || "").toLowerCase();
    const isCheckoutOrPaymentPage = currentPage === "checkout" || currentPage === "payment";


    if (!isCheckoutOrPaymentPage) {
        document.getElementById("footerContent").innerHTML += `
    <div class="footer__content-top page-width">
      <div class="grid grid--1-col grid--4-col-tablet">
        <!-- Brand Information Column -->
        <div class="grid__item">
          <img src="/img/secret-recipe-logo-white.png" style="max-width: min(100%, 250px); margin-top:-14px;" loading="lazy" alt="Secret Recipe Logo">
          <div class="footer-block__details-content">
            <p>
              Secret Recipe is your go-to choice for halal-certified cakes in Singapore.
              We offer islandwide delivery services, so everyone can savor our delicious
              sweet treats wherever they are. We believe in creating sweet moments and
              lasting memories.
            </p>
          </div>
          <div class="certification-row" style="display: flex; align-items: center; margin-top: 1rem; margin-bottom: 2rem; gap:10px;">
            <img src="/img/halal.png" alt="Halal Certification" style="max-height: 70px;" loading="lazy">
            <img src="/img/SOC CI UKAS-H-FSSC 22000-RGB.jpg" alt="Food Safety Certification" style="max-height: 70px;" loading="lazy">
          </div>
        </div>

        <!-- Quick Links Column -->
        <div class="grid__item">
          <h2 class="footer-block__heading">Quick Links</h2>
          <ul class="footer-block__details-content list-unstyled">
            <li><a href="/SecretRecipe/AboutUs" class="link link--text list-menu__item list-menu__item--link">About Us</a></li>
            <li><a href="/SecretRecipe/Faq" class="link link--text list-menu__item list-menu__item--link">FAQ</a></li>
            <li><a href="/SecretRecipe/JoinOurTeam" class="link link--text list-menu__item list-menu__item--link">Careers</a></li>
            <li><a href="/SecretRecipe/Terms" class="link link--text list-menu__item list-menu__item--link">Terms & Conditions</a></li>

          </ul>
        </div>


        <!-- Quick Links Column -->
        <div class="grid__item">
          <h2 class="footer-block__heading">Contact Us</h2>
          <ul class="footer-block__details-content list-unstyled">
            <li><a href="/SecretRecipe/Outlets" class="link link--text list-menu__item list-menu__item--link">Store Locator</a></li>
            <li><a href="/SecretRecipe/Feedback" class="link link--text list-menu__item list-menu__item--link">Feedback Form</a></li>
          </ul>
        </div>

        <!-- Social Media Column -->
        <div class="grid__item">
          <h2 class="footer-block__heading">Follow Us</h2>
          <ul class="footer__list-social list-unstyled list-social" role="list">
            <li class="list-social__item">
              <a href="https://facebook.com/secretrecipe.sg" class="link link--text list-social__link" aria-label="Facebook">
                <svg aria-hidden="true" focusable="false" role="presentation" class="icon icon-facebook" viewBox="0 0 18 18">
                  <path fill="currentColor" d="M16.42.61c.27 0 .5.1.69.28.19.2.28.42.28.7v15.44c0 .27-.1.5-.28.69a.94.94 0 01-.7.28h-4.39v-6.7h2.25l.31-2.65h-2.56v-1.7c0-.4.1-.72.28-.93.18-.2.5-.32 1-.32h1.37V3.35c-.6-.06-1.27-.1-2.01-.1-1.01 0-1.83.3-2.45.9-.62.6-.93 1.44-.93 2.53v1.97H7.04v2.65h2.24V18H.98c-.28 0-.5-.1-.7-.28a.94.94 0 01-.28-.7V1.59c0-.27.1-.5.28-.69a.94.94 0 01.7-.28h15.44z"></path>
                </svg>
                <span class="visually-hidden">Facebook</span>
              </a>
            </li>
            <li class="list-social__item">
              <a href="http://instagram.com/secretrecipe.sg" class="link link--text list-social__link" aria-label="Instagram">
                <svg aria-hidden="true" focusable="false" role="presentation" class="icon icon-instagram" viewBox="0 0 18 18">
                  <path fill="currentColor" d="M8.77 1.58c2.34 0 2.62.01 3.54.05.86.04 1.32.18 1.63.3.41.17.7.35 1.01.66.3.3.5.6.65 1 .12.32.27.78.3 1.64.05.92.06 1.2.06 3.54s-.01 2.62-.05 3.54a4.79 4.79 0 01-.3 1.63c-.17.41-.35.7-.66 1.01-.3.3-.6.5-1.01.66-.31.12-.77.26-1.63.3-.92.04-1.2.05-3.54.05s-2.62 0-3.55-.05a4.79 4.79 0 01-1.62-.3c-.42-.16-.7-.35-1.01-.66-.31-.3-.5-.6-.66-1a4.87 4.87 0 01-.3-1.64c-.04-.92-.05-1.2-.05-3.54s0-2.62.05-3.54c.04-.86.18-1.32.3-1.63.16-.41.35-.7.66-1.01.3-.3.6-.5 1-.65.32-.12.78-.27 1.63-.3.93-.05 1.2-.06 3.55-.06zm0-1.58C6.39 0 6.09.01 5.15.05c-.93.04-1.57.2-2.13.4-.57.23-1.06.54-1.55 1.02C1 1.96.7 2.45.46 3.02c-.22.56-.37 1.2-.4 2.13C0 6.1 0 6.4 0 8.77s.01 2.68.05 3.61c.04.94.2 1.57.4 2.13.23.58.54 1.07 1.02 1.56.49.48.98.78 1.55 1.01.56.22 1.2.37 2.13.4.94.05 1.24.06 3.62.06 2.39 0 2.68-.01 3.62-.05.93-.04 1.57-.2 2.13-.41a4.27 4.27 0 001.55-1.01c.49-.49.79-.98 1.01-1.56.22-.55.37-1.19.41-2.13.04-.93.05-1.23.05-3.61 0-2.39 0-2.68-.05-3.62a6.47 6.47 0 00-.4-2.13 4.27 4.27 0 00-1.02-1.55A4.35 4.35 0 0014.52.46a6.43 6.43 0 00-2.13-.41A69 69 0 008.77 0z"></path>
                  <path fill="currentColor" d="M8.8 4a4.5 4.5 0 100 9 4.5 4.5 0 000-9zm0 7.43a2.92 2.92 0 110-5.85 2.92 2.92 0 010 5.85zM13.43 5a1.05 1.05 0 100-2.1 1.05 1.05 0 000 2.1z"></path>
                </svg>
                <span class="visually-hidden">Instagram</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Footer Bottom Section -->
    <div class="footer__content-bottom">
      <div class="footer__content-bottom-wrapper page-width">
        <div class="footer__column footer__column--info">
          <div class="footer__copyright caption">
            <div class="copyright__content">
              Copyright © ${new Date().getFullYear()} Secret Recipe Int'l Pte. Ltd. (Co./GST Reg. No. 200908575W).            
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
    }
});



function GetDropDownMenu() {
    cartCount();

    if (menuDropdownCache && Array.isArray(menuDropdownCache)) {
        renderDropdowns(menuDropdownCache);
        return;
    }

    if (menuDropdownFetching) return;
    menuDropdownFetching = true;

    $.ajax({
        type: "GET",
        dataType: "json",
        cache: false,
        url: "/SR/GetMenuCatg",
        success: function (data) {
            menuDropdownFetching = false;
            menuDropdownCache = data.response?.data || [];

            // Save to sessionStorage
            sessionStorage.setItem("menuDropdownCache", JSON.stringify(menuDropdownCache));
            sessionStorage.setItem("menu_count", menuDropdownCache.length);

            renderDropdowns(menuDropdownCache);
        },
        error: function () {
            menuDropdownFetching = false;
        }
    });
}
// Utility to render dropdowns
function renderDropdowns(menuData) {
    getCoolerbag();

    const homeFav = document.getElementById("dropdownCakes");
    const homeFav1 = document.getElementById("dropdownCakes1");
    const otherDropMenu = document.getElementById("otherDropMenu");
    const otherDropMenu1 = document.getElementById("otherDropMenu1");

    if (!homeFav || !homeFav1 || !otherDropMenu || !otherDropMenu1) return;

    // Filter normal cakes and SR Packaging
    const normalCakes = menuData.filter(item => item.description !== "SR Packaging" && item.menuCatgImage);
    const srPackaging = menuData.filter(item => item.description === "SR Packaging");

    // Build HTML for normal cakes
    let htmlContent = `<a href="/SecretRecipe/CakeCategories">All Cakes</a>`;
    normalCakes.forEach(item => {
        const link = `/SecretRecipe/CakeCategories?cat=${encodeURIComponent(item.productCategory)}&desc=${encodeURIComponent(item.description)}`;
        htmlContent += `<a href="${link}">${item.description}</a>`;
    });

    // Build HTML for SR Packaging (Cooler Bag)
    let htmlContent1 = '';
    srPackaging.forEach(item => {
        const link = `/SecretRecipe/Coolerbag?cat=${encodeURIComponent(item.productCategory)}`;
        htmlContent1 += `<a href="${link}")>Cooler Bag</a>`;
        sessionStorage.setItem("coolerBagCategoryID", item.productCategory);

    });

    // Render dropdowns
    homeFav.innerHTML = htmlContent;
    homeFav1.innerHTML = htmlContent;
    otherDropMenu.innerHTML = htmlContent1;
    otherDropMenu1.innerHTML = htmlContent1;
    otherDropMenu1.innerHTML = htmlContent1;
}


//function getCoolerbag() {
//    cartCount();

//    // Try to get category from URL first, fallback to session
//    const urlParams = new URLSearchParams(window.location.search);
//    let productCategoryId = urlParams.get("cat") || sessionStorage.getItem("coolerBagCategoryID");
//    if (!productCategoryId) return;


//    const menuPackageCache = sessionStorage.getItem("menuPackageCache");
//    if (!menuPackageCache) return;

//    let packages;
//    try {
//        packages = JSON.parse(menuPackageCache);
//    } catch (err) {
//        console.error("Invalid JSON in menuPackageCache:", err);
//        return;
//    }

//    // Find cooler bag info by category
//    const coolerBagInfo = packages.find(item => item.productCategory === productCategoryId);
//    if (!coolerBagInfo) return;

//    coolerBagInfoGlobal = coolerBagInfo;
//    sessionStorage.setItem("coolerBagInfo", JSON.stringify(coolerBagInfo));

//    resolveImage(coolerBagInfo.image).then(imgSrc => {
//        sessionStorage.setItem("coolerbagImgsrc", imgSrc);
//    });

//    const imgSrc = sessionStorage.getItem("coolerbagImgsrc");
//    // Get the <img> inside the <li>
//    const slideLi = document.getElementById("ProductPhoto-slide01");
//    if (slideLi) {
//        const imgElement = slideLi.querySelector("img");
//        if (imgElement) {
//            const defaultImg = imgSrc;
//            imgElement.src = defaultImg;
//            imgElement.addEventListener("mouseleave", () => imgElement.src = defaultImg);
//        }
//    }

//    // Set the price
//    const priceElement = document.getElementById("itemPrice");
//    if (priceElement) {
//        priceElement.innerText = "SGD$ " + coolerBagInfo.unitPrice.toFixed(2);
//    }
//}
function getCoolerbag() {
    cartCount();

    // Try to get category from URL first, fallback to session
    const urlParams = new URLSearchParams(window.location.search);
    let productCategoryId = urlParams.get("cat") || sessionStorage.getItem("coolerBagCategoryID");
    //let IcingSession = sessionStorage.getItem("getIcingImageInfo");
    //if (!IcingSession) {
    //    getIcingImageInfo();
    //}

    if (!productCategoryId) return;

    const menuPackageCache = sessionStorage.getItem("menuPackageCache");
    if (!menuPackageCache) return;

    let packages;
    try {
        packages = JSON.parse(menuPackageCache);
    } catch (err) {
        console.error("Invalid JSON in menuPackageCache:", err);
        return;
    }

    // Find cooler bag info by category
    const coolerBagInfo = packages.find(item => item.productCategory === productCategoryId);
    if (!coolerBagInfo) return;

    coolerBagInfoGlobal = coolerBagInfo;
    sessionStorage.setItem("coolerBagInfo", JSON.stringify(coolerBagInfo));

    // Resolve image async
    resolveImage(coolerBagInfo.image).then(imgSrc => {
        sessionStorage.setItem("coolerbagImgsrc", imgSrc);

        // Directly target the <img> element
        const imgElement = document.getElementById("ProductPhoto-slide01");
        if (imgElement) {
            imgElement.src = imgSrc;
            imgElement.addEventListener("mouseleave", () => imgElement.src = imgSrc);
        }
    }).catch(err => {
        console.error("Error resolving cooler bag image:", err);
    });

    // Set the price
    const priceElement = document.getElementById("itemPrice");
    if (priceElement) {
        priceElement.innerText = "SGD$ " + coolerBagInfo.unitPrice.toFixed(2);
    }
}

function getIcingImageInfo() {
    const menuPackageCache = sessionStorage.getItem("menuPackageCache");
    if (!menuPackageCache) return null;

    let packages;
    try {
        packages = JSON.parse(menuPackageCache);
    } catch (err) {
        console.error("Invalid JSON in menuPackageCache:", err);
        return null;
    }

    // Find package that has "Icing" in its name (case-insensitive)
    const icingImageInfo = packages.find(pkg =>
        pkg?.packageName?.toLowerCase().includes("icing")
    );

    if (!icingImageInfo) return null;

    // Prepare the info you want to store/return
    const infoToStore = {
        packageName: icingImageInfo.packageName,
        unitPrice: icingImageInfo.unitPrice,
        productId: icingImageInfo.product,
        menuPackage: icingImageInfo.menuPackage,
        available: icingImageInfo.available
    };

    // Store in sessionStorage
    sessionStorage.setItem("IcingImageInfo", JSON.stringify(infoToStore));

    // Return the object
    return infoToStore;
}



function RedirectMenuCategoriesByID(productCategory = "ALL", description = "All Cakes") {
    const mainProductGrid = document.getElementById('cakesMenu');
    const loader = document.getElementById('loaderCakes');
    const tabContainer = document.getElementById("menuTabs");
    const dropDownCategories = document.getElementById("menuDropdown");

    if (!tabContainer) return;

    if (mainProductGrid && loader) {
        loader.style.display = 'block';
        mainProductGrid.classList.add('loading');
    }

    const renderTabsAndDropdown = (menuData) => {
        menuCategoriesCache = menuData;

        // Build tabs HTML
        let htmlContent = `<div class="tab-item text-gray-400 cursor-pointer pb-3" data-category="ALL">All Cakes</div>`;
        let dropdownOptions = `<option value="ALL">All Cakes</option>`;

        menuData.forEach(item => {
            const category = item.productCategory;
            const desc = item.description;
            const img = item.menuCatgImage;

            if (img && desc !== "SR Packaging") {
                htmlContent += `<div class="tab-item text-gray-400 cursor-pointer pb-3" data-category="${category}">${desc}</div>`;
                dropdownOptions += `<option value="${category}">${desc}</option>`;
            }
        });

        tabContainer.innerHTML = htmlContent;
        if (dropDownCategories) dropDownCategories.innerHTML = dropdownOptions;

        // Bind tab clicks
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', function () {
                const cat = this.getAttribute('data-category');
                setActiveTabByCategory(cat);
                if (cat === "ALL") {
                    loadProductsForCategory();
                    if (dropDownCategories) dropDownCategories.value = "ALL";
                } else {
                    GetMenuCategoriesByID(cat);
                    if (dropDownCategories) dropDownCategories.value = cat;
                }
            });
        });

        // Bind dropdown change
        if (dropDownCategories) {
            dropDownCategories.addEventListener('change', function () {
                const category = this.value;
                setActiveTabByCategory(category);
                if (category === "ALL") loadProductsForCategory();
                else GetMenuCategoriesByID(category);
            });
        }

        // ✅ Set active tab after rendering tabs
        setActiveTabByCategory(productCategory);
        if (dropDownCategories) dropDownCategories.value = productCategory;

        // ✅ Wait for all images in the grid to load before unfreezing
        const images = mainProductGrid.querySelectorAll('img');
        if (images.length > 0) {
            let loadedCount = 0;
            images.forEach(img => {
                if (img.complete) {
                    loadedCount++;
                } else {
                    img.addEventListener('load', () => {
                        loadedCount++;
                        if (loadedCount === images.length) {
                            mainProductGrid.classList.remove('loading');
                            loader.style.display = 'none';
                        }
                    });
                    img.addEventListener('error', () => {
                        loadedCount++;
                        if (loadedCount === images.length) {
                            mainProductGrid.classList.remove('loading');
                            loader.style.display = 'none';
                        }
                    });
                }
            });

            // If all images were already loaded
            if (loadedCount === images.length) {
                mainProductGrid.classList.remove('loading');
                loader.style.display = 'none';
            }
        } else {
            // No images, remove loader immediately
            mainProductGrid.classList.remove('loading');
            loader.style.display = 'none';
        }
    };

    // Fetch categories if cache empty
    if (menuCategoriesCache && menuCategoriesCache.length > 0) {
        renderTabsAndDropdown(menuCategoriesCache);
    } else {
        $.ajax({
            type: "GET",
            dataType: "json",
            cache: false,
            url: "/SR/GetMenuCatg",
            success: function (data) {
                const menuData = data.response?.data || [];
                renderTabsAndDropdown(menuData);
            },
            error: function () {
                console.error("Failed to load menu categories");
                if (mainProductGrid && loader) {
                    mainProductGrid.classList.remove('loading');
                    loader.style.display = 'none';
                }
            }
        });
    }

    // Load initial products
    if (productCategory && productCategory !== "ALL") {
        GetMenuCategoriesByID(productCategory);
    } else {
        loadProductsForCategory();
    }
}
//function GetMenuCategoriesByID(productCategory) {
//    let mainProductGrid = document.getElementById('cakesMenu');
//    let loader = document.getElementById('loaderCakes');

//    // Show loader (optionally add class to fade or dim existing content)
//    loader.style.display = 'block';
//    mainProductGrid.classList.add('loading'); // Use this class to hide/dim content via CSS

//    $.ajax({
//        type: "GET",
//        dataType: "json",
//        cache: false,
//        url: `/SR/GetMenuPackageSession?packageId=${productCategory}`,
//        success: function (data) {
//            try {
//                const responseData = Array.isArray(data.response.data)
//                    ? data.response.data
//                    : JSON.parse(data.response.data);

//                if (!responseData || responseData.length === 0) {
//                    mainProductGrid.innerHTML = '<div class="error-message">No menu items found.</div>';
//                } else {
//                    let newContent = '';
//                    responseData.forEach(item => {
//                        if (!item) return;

//                        const {
//                            menuCatgImage: menuImg,
//                            menuCatgImage2: menuImg2,
//                            menuPackage$_identifier: itemName = "No Description",
//                            amount,
//                            menuPackage: menuPackageId
//                        } = item;

//                        const itemPrice = parseFloat(amount) || 0;

//                        newContent += `
//                            <div class="product-card1">
//                                    <a href="/SecretRecipe/Product/${menuPackageId}?menuPackage=${menuPackageId}" onclick="sessionStorage.setItem('menuPackage','${menuPackageId}')" class="full-unstyled-link product-link1">
//                                    <div class="product-image1 hover-image-wrapper">

//                                        <img class="default-img" src="data:image/png;base64,${menuImg}" alt="${itemName}" loading="lazy">
//                                        <img class="hover-img" src="data:image/png;base64,${menuImg2}" alt="${itemName}" loading="lazy">

//                                    </div>
//                                    <div class="product-info1">
//                                        <h3 class="product-title1">${itemName}</h3>
//                                        <p class="product-price1">SGD$${itemPrice.toFixed(2)}</p>
//                                    </div>
//                                </a>
//                            </div>
//                        `;
//                    });

//                    // Replace all at once
//                    mainProductGrid.innerHTML = newContent;
//                }
//            } catch (error) {
//                console.error("Error handling menu data:", error);
//                mainProductGrid.innerHTML = '<div class="error-message">Error loading menu items.</div>';
//            } finally {
//                loader.style.display = 'none';
//                mainProductGrid.classList.remove('loading');
//            }
//        },
//        error: function (xhr, status, err) {
//            console.error("AJAX error:", status, err);
//            mainProductGrid.innerHTML = '<div class="error-message">Failed to load menu items. Please try again later.</div>';
//            loader.style.display = 'none';
//            mainProductGrid.classList.remove('loading');
//        }
//    });
//}
function renderProducts(products, mainProductGrid, loader) {
    // ✅ Sort products by menuSequence ascending before rendering
    const sortedProducts = products
        .filter(item => {
            return item?.packageName?.toLowerCase() !== "cooler bag"
                && item?.productCategory$_identifier !== "SR Packaging";
        })
        .sort((a, b) => {
            const seqA = a.menuSequence != null ? Number(a.menuSequence) : Infinity;
            const seqB = b.menuSequence != null ? Number(b.menuSequence) : Infinity;
            return seqA - seqB;
        });


    const newContent = sortedProducts.map(item => {
        if (!item) return '';

        const {
            packageName: itemName = "No Description",
            amount,
            menuPackage: menuPackageId,
            image,
            image02,
            newItem = false,
            bestseller = false,
            available = true
        } = item;

        const itemPrice = parseFloat(amount) || 0;
        const defaultImg = image ? getImageUrl(image) : '/images/default.png';
        const hoverImg = image02 ? getImageUrl(image02) : defaultImg;

        let badgeHTML = '';
        if (!available) {
            badgeHTML = `<span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
                              style="position:absolute;top:0.55rem;right:0.4rem;background-color:gray;color:white;font-size:10px;font-weight:bold;padding:0.65rem 0.75rem;border-radius:50px;z-index:2;display:inline-block;min-width:90px;text-align:center;">OUT OF STOCK</span>`;
        } else if (newItem) {
            badgeHTML = `<span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
                              style="position:absolute;top:0.55rem;right:0.4rem;background-color:rgb(237,27,37);color:white;font-size:10px;font-weight:bold;padding:0.65rem 0.75rem;border-radius:50px;z-index:2;display:inline-block;min-width:90px;text-align:center;">NEW</span>`;
        } else if (bestseller) {
            badgeHTML = `<span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
                              style="position:absolute;top:0.55rem;right:0.4rem;background-color:rgb(245,111,0);color:white;font-size:10px;font-weight:bold;padding:0.65rem 0.75rem;border-radius:50px;z-index:2;display:inline-block;min-width:90px;text-align:center;">Best Seller</span>`;
        }

        const greyClass = !available ? 'opacity-50 grayscale pointer-events-none' : '';
        const priceClass = !available ? 'text-gray-400' : '';
        const nameClass = !available ? 'text-gray-500' : '';

        const wrapperStart = available
            ? `<a href="/SecretRecipe/Product/${menuPackageId}?menuPackage=${menuPackageId}" 
                   onclick="sessionStorage.setItem('menuPackage','${menuPackageId}')" 
                   class="full-unstyled-link product-link1">`
            : `<div class="product-link1">`;

        const wrapperEnd = available ? `</a>` : `</div>`;

        return `
            <div class="product-card1 ${greyClass}">
                ${wrapperStart}
                    <div class="product-image1 hover-image-wrapper">
                        ${badgeHTML}
                        <img class="default-img" src="${defaultImg}" alt="${itemName}" loading="lazy" decoding="async">
                        <img class="hover-img" src="${hoverImg}" alt="${itemName}" loading="lazy" decoding="async" data-preload="false">
                    </div>
                    <div class="product-info1">
                        <h3 class="product-title1 ${nameClass}">${itemName}</h3>
                        <p class="product-price1 ${priceClass}">SGD$ ${itemPrice.toFixed(2)}</p>
                    </div>
                ${wrapperEnd}
            </div>
        `;
    }).join('');

    mainProductGrid.innerHTML = newContent;

    // Lazy load hover images
    const observerOptions = {
        root: null,
        rootMargin: '50px',
        threshold: 0.01
    };
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const hoverImg = entry.target.querySelector('.hover-img');
                if (hoverImg && hoverImg.dataset.preload === 'false') {
                    const img = new Image();
                    img.src = hoverImg.src;
                    hoverImg.dataset.preload = 'true';
                }
                imageObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);
    document.querySelectorAll('.product-card1').forEach(card => imageObserver.observe(card));

    // Tab UI logic
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('text-black', 'font-bold'));
            this.classList.add('text-black', 'font-bold');
            moveUnderline(this);
        });
    });

    const defaultTab = Array.from(document.querySelectorAll('.tab-item'))
        .find(tab => tab.textContent.trim().toUpperCase() === "ALL CAKES")
        || document.querySelector('.tab-item');

    if (defaultTab) {
        defaultTab.classList.add('text-black', 'font-bold');
        moveUnderline(defaultTab);
    }

    if (loader) loader.style.display = 'none';
    mainProductGrid.classList.remove('loading');
}



//function renderProducts(products, mainProductGrid, loader) {
//    const newContent = products
//        .filter(item => {
//            // ✅ Skip cooler bag (match by packageName or category)
//            return item?.packageName?.toLowerCase() !== "cooler bag"
//                && item?.productCategory$_identifier !== "SR Packaging";
//        })
//        .map(item => {
//            if (!item) return '';

//            const {
//                packageName: itemName = "No Description",
//                amount,
//                menuPackage: menuPackageId,
//                image,
//                image02,
//                newItem = false,
//                bestseller = false,
//                available = true
//            } = item;

//            const itemPrice = parseFloat(amount) || 0;
//            const defaultImg = image ? getImageUrl(image) : '/images/default.png';
//            const hoverImg = image02 ? getImageUrl(image02) : defaultImg;

//            let badgeHTML = '';
//            if (!available) {
//                badgeHTML = `<span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                                  style="position:absolute;top:0.55rem;right:0.4rem;background-color:gray;color:white;font-size:10px;font-weight:bold;padding:0.65rem 0.75rem;border-radius:50px;z-index:2;display:inline-block;min-width:90px;text-align:center;">OUT OF STOCK</span>`;
//            } else if (newItem) {
//                badgeHTML = `<span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                                  style="position:absolute;top:0.55rem;right:0.4rem;background-color:rgb(237,27,37);color:white;font-size:10px;font-weight:bold;padding:0.65rem 0.75rem;border-radius:50px;z-index:2;display:inline-block;min-width:90px;text-align:center;">NEW</span>`;
//            } else if (bestseller) {
//                badgeHTML = `<span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                                  style="position:absolute;top:0.55rem;right:0.4rem;background-color:rgb(245,111,0);color:white;font-size:10px;font-weight:bold;padding:0.65rem 0.75rem;border-radius:50px;z-index:2;display:inline-block;min-width:90px;text-align:center;">Best Seller</span>`;
//            }

//            const greyClass = !available ? 'opacity-50 grayscale pointer-events-none' : '';
//            const priceClass = !available ? 'text-gray-400' : '';
//            const nameClass = !available ? 'text-gray-500' : '';

//            const wrapperStart = available
//                ? `<a href="/SecretRecipe/Product/${menuPackageId}?menuPackage=${menuPackageId}" 
//                       onclick="sessionStorage.setItem('menuPackage','${menuPackageId}')" 
//                       class="full-unstyled-link product-link1">`
//                : `<div class="product-link1">`;

//            const wrapperEnd = available ? `</a>` : `</div>`;

//            return `
//                <div class="product-card1 ${greyClass}">
//                    ${wrapperStart}
//                        <div class="product-image1 hover-image-wrapper">
//                            ${badgeHTML}
//                            <img class="default-img" src="${defaultImg}" alt="${itemName}" loading="lazy">
//                            <img class="hover-img" src="${hoverImg}" alt="${itemName}" loading="lazy">
//                        </div>
//                        <div class="product-info1">
//                            <h3 class="product-title1 ${nameClass}">${itemName}</h3>
//                            <p class="product-price1 ${priceClass}">SGD$ ${itemPrice.toFixed(2)}</p>
//                        </div>
//                    ${wrapperEnd}
//                </div>
//            `;
//        }).join('');

//    mainProductGrid.innerHTML = newContent;

//    // Tab UI logic
//    document.querySelectorAll('.tab-item').forEach(tab => {
//        tab.addEventListener('click', function () {
//            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('text-black', 'font-bold'));
//            this.classList.add('text-black', 'font-bold');
//            moveUnderline(this);
//        });
//    });

//    const defaultTab = Array.from(document.querySelectorAll('.tab-item'))
//        .find(tab => tab.textContent.trim().toUpperCase() === "ALL CAKES")
//        || document.querySelector('.tab-item');

//    if (defaultTab) {
//        defaultTab.classList.add('text-black', 'font-bold');
//        moveUnderline(defaultTab);
//    }

//    if (loader) loader.style.display = 'none';
//    mainProductGrid.classList.remove('loading');
//}
//function renderProducts(products, mainProductGrid, loader) {
//    const newContent = products
//        .filter(item => {
//            // ✅ Skip cooler bag (match by packageName or category)
//            return item?.packageName?.toLowerCase() !== "cooler bag"
//                && item?.productCategory$_identifier !== "SR Packaging";
//        })
//        .map(item => {
//            if (!item) return '';

//            const {
//                packageName: itemName = "No Description",
//                amount,
//                menuPackage: menuPackageId,
//                image,
//                image02,
//                newItem = false,
//                bestseller = false,
//                available = true
//            } = item;

//            const itemPrice = parseFloat(amount) || 0;
//            const defaultImg = image ? getImageUrl(image) : '/images/default.png';
//            const hoverImg = image02 ? getImageUrl(image02) : defaultImg;

//            let badgeHTML = '';
//            if (!available) {
//                badgeHTML = `<span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                                  style="position:absolute;top:0.55rem;right:0.4rem;background-color:gray;color:white;font-size:10px;font-weight:bold;padding:0.65rem 0.75rem;border-radius:50px;z-index:2;display:inline-block;min-width:90px;text-align:center;">OUT OF STOCK</span>`;
//            } else if (newItem) {
//                badgeHTML = `<span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                                  style="position:absolute;top:0.55rem;right:0.4rem;background-color:rgb(237,27,37);color:white;font-size:10px;font-weight:bold;padding:0.65rem 0.75rem;border-radius:50px;z-index:2;display:inline-block;min-width:90px;text-align:center;">NEW</span>`;
//            } else if (bestseller) {
//                badgeHTML = `<span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                                  style="position:absolute;top:0.55rem;right:0.4rem;background-color:rgb(245,111,0);color:white;font-size:10px;font-weight:bold;padding:0.65rem 0.75rem;border-radius:50px;z-index:2;display:inline-block;min-width:90px;text-align:center;">Best Seller</span>`;
//            }

//            const greyClass = !available ? 'opacity-50 grayscale pointer-events-none' : '';
//            const priceClass = !available ? 'text-gray-400' : '';
//            const nameClass = !available ? 'text-gray-500' : '';

//            const wrapperStart = available
//                ? `<a href="/SecretRecipe/Product/${menuPackageId}?menuPackage=${menuPackageId}" 
//                       onclick="sessionStorage.setItem('menuPackage','${menuPackageId}')" 
//                       class="full-unstyled-link product-link1">`
//                : `<div class="product-link1">`;

//            const wrapperEnd = available ? `</a>` : `</div>`;

//            // Escape single quotes in itemName for error handler
//            const escapedItemName = itemName.replace(/'/g, "\\'");

//            return `
//                <div class="product-card1 ${greyClass}">
//                    ${wrapperStart}
//                        <div class="product-image1 hover-image-wrapper">
//                            ${badgeHTML}
//                            <img class="default-img" 
//                                 src="${defaultImg}" 
//                                 alt="${itemName}" 
//                                 loading="lazy"
//                                 onerror="this.onerror=null; this.src='/images/default.png';">
//                            <img class="hover-img" 
//                                 src="${hoverImg}" 
//                                 alt="${itemName}" 
//                                 loading="lazy"
//                                 onerror="this.onerror=null; this.src='${defaultImg}';">
//                        </div>
//                        <div class="product-info1">
//                            <h3 class="product-title1 ${nameClass}">${itemName}</h3>
//                            <p class="product-price1 ${priceClass}">SGD$ ${itemPrice.toFixed(2)}</p>
//                        </div>
//                    ${wrapperEnd}
//                </div>
//            `;
//        }).join('');

//    // Set content immediately - no delays
//    mainProductGrid.innerHTML = newContent;

//    // Optimized tab handling - remove existing listeners to prevent duplicates
//    document.querySelectorAll('.tab-item').forEach(tab => {
//        // Clone node to remove all existing event listeners
//        const newTab = tab.cloneNode(true);
//        tab.parentNode.replaceChild(newTab, tab);

//        // Add single event listener
//        newTab.addEventListener('click', function () {
//            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('text-black', 'font-bold'));
//            this.classList.add('text-black', 'font-bold');
//            if (typeof moveUnderline === 'function') {
//                moveUnderline(this);
//            }
//        });
//    });

//    // Set default tab
//    const defaultTab = Array.from(document.querySelectorAll('.tab-item'))
//        .find(tab => tab.textContent.trim().toUpperCase() === "ALL CAKES")
//        || document.querySelector('.tab-item');

//    if (defaultTab) {
//        defaultTab.classList.add('text-black', 'font-bold');
//        if (typeof moveUnderline === 'function') {
//            moveUnderline(defaultTab);
//        }
//    }

//    // Hide loader and remove loading state
//    if (loader) loader.style.display = 'none';
//    mainProductGrid.classList.remove('loading');

//    // Add minimal performance styles only once
//    addMinimalStyles();
//}

// Add only essential styles for better image handling
function addMinimalStyles() {
    if (document.getElementById('minimal-product-styles')) return;

    const styleTag = document.createElement('style');
    styleTag.id = 'minimal-product-styles';
    styleTag.innerHTML = `
        /* Minimal performance-focused styles */
        .hover-image-wrapper {
            position: relative;
            overflow: hidden;
        }
        
        .hover-image-wrapper .default-img,
        .hover-image-wrapper .hover-img {
            transition: opacity 0.3s ease;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .hover-image-wrapper .hover-img {
            position: absolute;
            top: 0;
            left: 0;
            opacity: 0;
            pointer-events: none;
        }
        
        .hover-image-wrapper:hover .default-img {
            opacity: 0;
        }
        
        .hover-image-wrapper:hover .hover-img {
            opacity: 1;
        }
        
        /* Optimize for mobile - disable hover effects */
        @media (hover: none) {
            .hover-image-wrapper .hover-img {
                display: none;
            }
            
            .hover-image-wrapper .default-img,
            .hover-image-wrapper .hover-img {
                transition: none;
            }
        }
        
        /* Ensure images don't cause layout shift */
        .product-image1 {
            aspect-ratio: 1 / 1;
            background-color: #f8f9fa;
        }
        
        .product-image1 img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    `;

    document.head.appendChild(styleTag);
}


function GetMenuCategoriesByID(productCategory) {
    const mainProductGrid = document.getElementById('cakesMenu');
    const loader = document.getElementById('loaderCakes');

    if (mainProductGrid && loader) loader.style.display = 'block';
    if (mainProductGrid) mainProductGrid.classList.add('loading');

    const sortBySequence = (a, b) => {
        const seqA = a.menuSequence != null ? Number(a.menuSequence) : Infinity;
        const seqB = b.menuSequence != null ? Number(b.menuSequence) : Infinity;
        return seqA - seqB;
    };

    const renderSorted = (products) => {
        const filteredProducts = products.filter(item => item.productCategory === productCategory);
        const sortedProducts = filteredProducts.sort(sortBySequence);
        console.log("sortedProducts", sortedProducts);
        if (mainProductGrid) renderProducts(sortedProducts, mainProductGrid, loader);
        if (mainProductGrid && loader) loader.style.display = 'none';
        if (mainProductGrid) mainProductGrid.classList.remove('loading');
    };

    // Use cache if available
    if (menuPackageCache && Array.isArray(menuPackageCache) && menuPackageCache.length > 0) {
        renderSorted(menuPackageCache);
        return;
    }

    // Fallback to API
    $.ajax({
        type: "GET",
        dataType: "json",
        cache: false,
        url: `/SR/GetMenuPackageSession?packageId=${productCategory}`,
        success: function (data) {
            let responseData = data?.response?.data;

            if (typeof responseData === 'string') {
                try {
                    responseData = JSON.parse(responseData)?.response?.data;
                } catch (err) {
                    console.error("JSON parse error:", err);
                    responseData = [];
                }
            }

            if (!Array.isArray(responseData) || responseData.length === 0) {
                if (mainProductGrid) mainProductGrid.innerHTML = '<div class="error-message">No menu items found.</div>';
                if (mainProductGrid && loader) loader.style.display = 'none';
                if (mainProductGrid) mainProductGrid.classList.remove('loading');
                return;
            }

            // Cache for future
            menuPackageCache = responseData;
            renderSorted(responseData);
        },
        error: function () {
            if (mainProductGrid) mainProductGrid.innerHTML = '<div class="error-message">Failed to load menu items.</div>';
            if (mainProductGrid && loader) loader.style.display = 'none';
            if (mainProductGrid) mainProductGrid.classList.remove('loading');
        }
    });
}

//function GetMenuCategoriesByID(productCategory) {
//    const mainProductGrid = document.getElementById('cakesMenu');
//    const loader = document.getElementById('loaderCakes');

//    if (loader) loader.style.display = 'block';
//    mainProductGrid.classList.add('loading');

//    $.ajax({
//        type: "GET",
//        dataType: "json",
//        cache: false,
//        url: `/SR/GetMenuPackageSession?packageId=${productCategory}`,
//        success: function (data) {
//            try {
//                let responseData = data?.response?.data;

//                if (typeof responseData === 'string') {
//                    const parsed = JSON.parse(responseData);
//                    responseData = parsed?.response?.data;
//                }

//                if (!Array.isArray(responseData) || responseData.length === 0) {
//                    mainProductGrid.innerHTML = '<div class="error-message">No menu items found.</div>';
//                    return;
//                }

//                const getImageUrl = id => `/SR/GetImageProxy?imageId=${encodeURIComponent(id)}`;

//                const newContent = responseData.map(item => {
//                    if (!item) return '';

//                    const {
//                        packageName: itemName = "No Description",
//                        amount,
//                        menuPackage: menuPackageId,
//                        image,
//                        image02,
//                        newItem = false,
//                        bestseller = false,
//                        available = true
//                    } = item;

//                    const itemPrice = parseFloat(amount) || 0;
//                    const defaultImg = image ? getImageUrl(image) : '/images/default.png';
//                    const hoverImg = image02 ? getImageUrl(image02) : defaultImg;

//                    let badgeHTML = '';

//                    if (!available) {
//                        badgeHTML = `
//                        <span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                              style="
//                                  position: absolute;
//                                  top: 0.55rem;
//                                  right: 0.4rem;
//                                  background-color: gray;
//                                  color: white;
//                                  font-size: 10px;
//                                  font-weight: bold;
//                                  padding: 0.65rem 0.75rem;
//                                  border-radius: 50px;
//                                  z-index: 2;
//                                  display: inline-block;
//                                  min-width: 90px;
//                                  text-align: center;">
//                            OUT OF STOCK
//                        </span>`;
//                    } else if (newItem) {
//                        badgeHTML = `
//                        <span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                              style="
//                                  position: absolute;
//                                  top: 0.55rem;
//                                  right: 0.4rem;
//                                  background-color: rgb(237, 27, 37);
//                                  color: white;
//                                  font-size: 10px;
//                                  font-weight: bold;
//                                  padding: 0.65rem 0.75rem;
//                                  border-radius: 50px;
//                                  z-index: 2;
//                                  display: inline-block;
//                                  min-width: 90px;
//                                  text-align: center;">
//                            NEW
//                        </span>`;
//                    } else if (bestseller) {
//                        badgeHTML = `
//                        <span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                              style="
//                                  position: absolute;
//                                  top: 0.55rem;
//                                  right: 0.4rem;
//                                  background-color: rgb(245, 111, 0);
//                                  color: white;
//                                  font-size: 10px;
//                                  font-weight: bold;
//                                  padding: 0.65rem 0.75rem;
//                                  border-radius: 50px;
//                                  z-index: 2;
//                                  display: inline-block;
//                                  min-width: 90px;
//                                  text-align: center;">
//                            Best Seller
//                        </span>`;
//                    }

//                    const greyClass = !available ? 'opacity-50 grayscale pointer-events-none' : '';
//                    const priceClass = !available ? 'text-gray-400' : '';
//                    const nameClass = !available ? 'text-gray-500' : '';

//                    const wrapperStart = available
//                        ? `<a href="/SecretRecipe/Product/${menuPackageId}?menuPackage=${menuPackageId}"
//                               onclick="sessionStorage.setItem('menuPackage','${menuPackageId}')"
//                               class="full-unstyled-link product-link1">`
//                        : `<div class="product-link1">`;

//                    const wrapperEnd = available ? `</a>` : `</div>`;

//                    return `
//                        <div class="product-card1 ${greyClass}">
//                            ${wrapperStart}
//                                <div class="product-image1 hover-image-wrapper">
//                                    ${badgeHTML}
//                                    <img class="default-img" src="${defaultImg}" alt="${itemName}" loading="lazy">
//                                    <img class="hover-img" src="${hoverImg}" alt="${itemName}" loading="lazy">
//                                </div>

//                                <div class="product-info1">
//                                    <h3 class="product-title1 ${nameClass}">${itemName}</h3>
//                                    <p class="product-price1 ${priceClass}">SGD$ ${itemPrice.toFixed(2)}</p>
//                                </div>
//                            ${wrapperEnd}
//                        </div>
//                    `;
//                }).join('');

//                mainProductGrid.innerHTML = newContent;

//            } catch (error) {
//                console.error("Error handling menu data:", error);
//                mainProductGrid.innerHTML = '<div class="error-message">Error loading menu items.</div>';
//            } finally {
//                if (loader) loader.style.display = 'none';
//                mainProductGrid.classList.remove('loading');
//            }
//        },
//        error: function (xhr, status, err) {
//            console.error("AJAX error:", status, err);
//            mainProductGrid.innerHTML = '<div class="error-message">Failed to load menu items. Please try again later.</div>';
//            if (loader) loader.style.display = 'none';
//            mainProductGrid.classList.remove('loading');
//        }
//    });
//}


function GetMenuCategories() {
    if (menuCategoriesCache) {
        console.log("Using cached menu categories");
        renderMenuCategories(menuCategoriesCache);
        return;
    }

    $.ajax({
        type: "GET",
        dataType: "json",
        cache: false,
        url: "/SR/GetMenuCatg",
        success: function (data) {
            const menuData = data.response?.data || [];
            menuCategoriesCache = menuData;
            sessionStorage.setItem("menuCategoriesCache", JSON.stringify(menuData));

            renderMenuCategories(menuData);
        }
    });
}

function renderMenuCategories(menuData) {
    const tabContainer = document.getElementById("menuTabs");
    const dropDownCategories = document.getElementById("menuDropdown");

    let htmlContent = `
        <div class="tab-item text-gray-400 cursor-pointer pb-3" data-category="ALL" onClick="loadProductsForCategory()">
            All Cakes
        </div>`;

    let dropdownOptions = `<option value="ALL">All Cakes</option>`;

    menuData.forEach(item => {
        const category = item.productCategory;
        const desc = item.description;
        const img = item.image;
        // Dynamically exclude SR Packaging without hardcoding a list
        if (category === "25D3186112E041A48F7973C1BC03FC32") return;
        if (img) {
            htmlContent += `
                <div class="tab-item text-gray-400 cursor-pointer pb-3"
                     data-category="${category}"
                     value="${category}"
                     onClick="GetMenuCategoriesByID('${category}')">
                    ${desc}
                </div>`;

            dropdownOptions += `
                <option value="${category}" data-url="/SecretRecipe/Menupack/${category}">
                    ${desc}
                </option>`;
        }
    });

    if (tabContainer) tabContainer.innerHTML = htmlContent + tabContainer.innerHTML;
    if (dropDownCategories) {
        dropDownCategories.innerHTML = dropdownOptions;

        dropDownCategories.addEventListener('change', function () {
            const selectedOption = this.options[this.selectedIndex];
            const category = selectedOption.value;

            if (category === "ALL") {
                loadProductsForCategory();
            } else {
                GetMenuCategoriesByID(category);
            }
        });
    }

    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('text-black', 'font-bold'));
            this.classList.add('text-black', 'font-bold');
            moveUnderline(this);
        });
    });

    const defaultTab = Array.from(document.querySelectorAll('.tab-item'))
        .find(tab => tab.textContent.trim().toUpperCase() === "ALL CAKES")
        || document.querySelector('.tab-item');

    if (defaultTab) {
        defaultTab.classList.add('text-black', 'font-bold');
        moveUnderline(defaultTab);
    }

    // Render all products if tab exists
    loadProductsForCategory();
}
// Back up 2025-08-14 -----//
//function GetMenuCategories() {
//    $.ajax({
//        type: "GET",
//        dataType: "json",
//        cache: false,
//        url: "/SR/GetMenuCatg",
//        success: function (data) {
//            const menuData = data.response?.data || [];
//            const tabContainer = document.getElementById("menuTabs");
//            const dropDownCategories = document.getElementById("menuDropdown");

//            // Create tab items
//            let htmlContent = `
//                <div class="tab-item text-gray-400 cursor-pointer pb-3" data-category="ALL" onClick="loadProductsForCategory()">
//                    All Cakes
//                </div>`;

//            // Create dropdown items
//            let dropdownOptions = `
//                <option value="ALL">All Cakes</option>`;

//            menuData.forEach(item => {
//                const category = item.productCategory;
//                const desc = item.description;
//                const img = item.image;

//                if (img) {

//                    htmlContent += `
//                        <div class="tab-item text-gray-400 cursor-pointer pb-3"
//                             data-category="${category}"
//                             value="${category}"
//                             onClick="GetMenuCategoriesByID('${category}')">
//                            ${desc}
//                        </div>`;

//                    dropdownOptions += `
//                        <option value="${category}" data-url="/SecretRecipe/Menupack/${category}">
//                            ${desc}
//                        </option>`;
//                }
//            });
//            //dropdownOptions += `<option value="" data-url="/SecretRecipe/">
//            //                        Icing Picture
//            //                    </option>`;

//            //htmlContent += `<div class="tab-item text-gray-400 cursor-pointer pb-3"
//            //                     data-category=""
//            //                     data-url="/SecretRecipe/">Icing Picture
//            //                </div>`;
//            // Inject tabs into container (preserve underline)
//            tabContainer.innerHTML = htmlContent + tabContainer.innerHTML;

//            // Inject dropdown options
//            if (dropDownCategories) {
//                dropDownCategories.innerHTML = dropdownOptions;

//                // Add change listener to dropdown
//                dropDownCategories.addEventListener('change', function () {
//                    const selectedOption = this.options[this.selectedIndex];
//                    const category = selectedOption.value;

//                    if (category === "ALL") {
//                        loadProductsForCategory(); // Load all cakes
//                    } else {
//                        GetMenuCategoriesByID(category); // Load specific category
//                    }
//                });

//            }

//            // Bind tab click events
//            document.querySelectorAll('.tab-item').forEach(tab => {
//                tab.addEventListener('click', function () {
//                    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('text-black', 'font-bold'));
//                    this.classList.add('text-black', 'font-bold');

//                    moveUnderline(this);

//                    //const cat = this.getAttribute("data-category");
//                    //const desc = this.textContent.trim();
//                    //const url = this.getAttribute("data-url");

//                    ////storeSessionData(cat, desc);
//                    //window.location.href = url;
//                });
//            });

//            // Activate default tab (e.g., CHEESE CAKES)
//            const defaultTab = Array.from(document.querySelectorAll('.tab-item'))
//                .find(tab => tab.textContent.trim().toUpperCase() === "ALL CAKES")
//                || document.querySelector('.tab-item');

//            if (defaultTab) {
//                defaultTab.classList.add('text-black', 'font-bold');
//                moveUnderline(defaultTab);
//            }
//        }
//    });

//    loadProductsForCategory();
//}


function moveUnderline(tabElement) {
    const underline = document.getElementById("activeUnderline");
    if (!underline || !tabElement) return;

    underline.style.width = `${tabElement.offsetWidth}px`;
    underline.style.left = `${tabElement.offsetLeft}px`;
}

function setActiveTabByCategory(category) {
    // Use a small timeout to ensure tabs are rendered
    setTimeout(() => {
        const tabs = document.querySelectorAll('.tab-item');

        // Remove active styling from all tabs
        tabs.forEach(tab => tab.classList.remove('text-black', 'font-bold'));

        // Find the tab to activate
        const activeTab = document.querySelector(`.tab-item[data-category="${category}"]`);
        if (activeTab) {
            activeTab.classList.add('text-black', 'font-bold');
            moveUnderline(activeTab);
        }
    }, 50); // Delay ensures DOM is ready
}

window.addEventListener('resize', () => {
    const activeTab = document.querySelector('.tab-item.text-black.font-bold');
    if (activeTab) moveUnderline(activeTab);
});

// Example: set initial active tab on page load
//document.addEventListener('DOMContentLoaded', () => {
//    // If you want "Cream Cakes" selected by default:
//    setActiveTabByCategory("88AE9D9F07DE4EBB86DC469A1E76F619");
//});

function cakeWritingCheckboxes() {
    // Get all the radio buttons and the textbox
    const naRadio = document.getElementById('input_NA');
    const enRadio = document.getElementById('input_EN');
    const cnRadio = document.getElementById('input_CN');
    const cakeWriting = document.getElementById('cake_writing');
    const cakeImageInput = document.getElementById('cake_image');
    const imageFilename = document.getElementById('image_filename');

    // Function to handle radio button changes
    //function handleRadioChange() {
    //    cakeWriting.disabled = naRadio.checked;
    //}

    // Function to handle image selection
    function handleImageSelection() {
        if (cakeImageInput.files && cakeImageInput.files[0]) {
            imageFilename.textContent = cakeImageInput.files[0].name;
        } else {
            imageFilename.textContent = 'No image selected';
        }
    }

    // Add event listeners to all radio buttons
    //naRadio.addEventListener('change', handleRadioChange);
    //enRadio.addEventListener('change', handleRadioChange);
    //cnRadio.addEventListener('change', handleRadioChange);

    // Add event listener for image upload
    if (cakeImageInput) {
        cakeImageInput.addEventListener('change', handleImageSelection);
    }
    // Initialize the state on page load
    //handleRadioChange();
}



function RedirectCasdoor(event, login) {
    event.preventDefault();
    const actionType = login === 'login' ? 'login' : 'signup';
    const redirectUrl = `/SR/RedirectCasdoor?actionType=${actionType}`;

    window.location.href = redirectUrl;
}



function callback(code) {
    console.log("Token Request:", code);

    $.ajax({
        url: `/SR/GetAccessToken?code=${code}`,
        type: 'POST',
        contentType: 'application/json',
        dataType: 'text',
        success: function (data) {
            try {
                const token = data.trim();
                jwtToken = token;
                // Store the token in localStorage (if you need persistence across sessions)
                localStorage.setItem('jwtToken', token);

                const decodedToken = decodeJwt(token);
                const userProfile = {
                    Id: decodedToken?.id,
                    DisplayName: decodedToken?.displayName,
                    Email: decodedToken?.email,
                    JWT: token
                };
                console.log(decodedToken);

                // Send user profile to server
                $.ajax({
                    url: '/SR/StoreUserProfileInSession',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(userProfile),
                    success: function () {
                        document.getElementById('loader').style.display = 'none';
                        window.location.href = "/SecretRecipe/Profile";
                        localStorage.setItem("LoggedIn", true);
                    },
                    error: function (xhr) {
                        console.error("Failed to store profile in session:", xhr.responseText);
                    }
                });
            } catch (error) {
                console.error("Failed to decode JWT token:", error);
            }
        },
        error: function (xhr) {
            console.error("Error fetching access token:", xhr.status, xhr.responseText);
        }
    });
}
async function GetUserProfile() {
    try {
        const jwtToken = localStorage.getItem("jwtToken");
        if (!jwtToken) throw new Error("JWT token is missing.");

        const response = await fetch('/SR/GetUserProfile', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${jwtToken}`
            }
        });

        const contentType = response.headers.get('content-type');
        const responseText = await response.text();

        if (!response.ok) throw new Error(`Status ${response.status}: ${responseText}`);
        if (!contentType || !contentType.includes('application/json')) {
            console.error("Expected JSON, got:", responseText);
            throw new Error("Invalid content type");
        }

        const userProfile = JSON.parse(responseText);
        console.log("User Profile:", userProfile);
        return userProfile;

    } catch (error) {
        console.error("Error fetching user profile:", error.message);
    }
}


//function GetUserProfile() {

//    $.ajax({
//        url: `/SR/GetUserProfile`,
//        type: 'POST',
//        contentType: 'application/json',
//        dataType: 'text',
//        success: function (data) {
//            try {
//                const token = data.trim();
//                const decodedToken = decodeJwt(token);

//                const userProfile = {
//                    Id: decodedToken?.id,
//                    DisplayName: decodedToken?.displayName,
//                    Email: decodedToken?.email
//                };

//                // Send user profile to server
//                $.ajax({
//                    url: '/SR/StoreUserProfileInSession',
//                    type: 'POST',
//                    contentType: 'application/json',
//                    data: JSON.stringify(userProfile),
//                    success: function () {
//                        document.getElementById('loader').style.display = 'none';
//                        window.location.href = "/SecretRecipe/GetUserProfile";
//                        localStorage.setItem("LoggedIn",true);
//                    },
//                    error: function (xhr) {
//                        console.error("Failed to store profile in session:", xhr.responseText);
//                    }
//                });

//            } catch (error) {
//                console.error("Failed to decode JWT token:", error);
//            }
//        },
//        error: function (xhr) {
//            console.error("Error fetching access token:", xhr.status, xhr.responseText);
//        }
//    });
//}



// Function to decode JWT token (example)
function decodeJwt(token) {
    try {
        // Ensure the token is a string and has the correct format
        if (typeof token !== 'string' || token.split('.').length !== 3) {
            throw new Error('Invalid JWT format');
        }

        // Extract the payload part of the JWT
        const base64Url = token.split('.')[1];

        // Convert Base64 URL to Base64
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

        // Decode Base64 to a JSON string
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(function (c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                })
                .join('')
        );

        // Parse the JSON string into an object
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Failed to decode JWT:', error);
        return null; // Return null or throw the error depending on your use case
    }
}
function GetOutletsDetails() {
    cartCount(); // Update cart count

    $.ajax({
        type: "GET",
        dataType: "json",
        url: "/SR/Outlets",
        success: function (data) {
            const parsedData = data.data ? JSON.parse(data.data) : data;
            console.log("Response:", parsedData);

            const outletImageMap = {
                "238839": "/img/SR-PSG.png",
                "310470": "/img/SR-TPY.png"
            };

            const tbodyContent = parsedData.response.data
                .filter(outlet => outletImageMap.hasOwnProperty(outlet.postalCode))
                .map(outlet => {
                    const fullDestination = `${outlet.addressLine1} ${outlet.addressLine2}, Singapore ${outlet.postalCode}`;
                    const encodedDestination = encodeURIComponent(fullDestination);
                    const imagePath = outletImageMap[outlet.postalCode];
                    const outletMapUrl = {
                        "238839": "https://maps.app.goo.gl/a6WjrrmsEpbnRBMB6", // Replace with correct URL
                        "310470": "https://maps.app.goo.gl/pbTqX2KyQxiaQZgd8"
                    };

                    const googleMapLink = outletMapUrl[outlet.postalCode] || `https://www.google.com/maps?q=${encodedDestination}`;
                    const rawNumber = outlet.whatsapp || outlet.phone || "";
                    const cleanNumber = rawNumber.replace(/[^0-9]/g, "");
                    const whatsappLink = cleanNumber ? `https://wa.me/${cleanNumber}` : "#";

                    // Extract identifier starting from "SR"
                    const fullIdentifier = outlet.warehouseOutlet$_identifier || outlet._identifier || "";
                    const truncatedIdentifier = fullIdentifier.split(' - ').slice(1).join(' - ') || fullIdentifier;

                    return `
                        <tr>
                            <td class="location-details">
                                <h2 class="outlet-title">${truncatedIdentifier}</h2>
                                <p><span class="icon">📍</span> <strong>Address:</strong> ${outlet.addressLine1} ${outlet.addressLine2 || ''}, Singapore ${outlet.postalCode}</p>
                                <p><span class="icon">🕐</span> <strong>Operating Hours:</strong> ${outlet.operatingHours || "N/A"}</p>
                                <p><span class="icon red-text">☎️</span> <strong>Phone:</strong> <a href="tel:${outlet.phone}"><span class="red-text">${outlet.phone || "N/A"}</span></a></p>
                                <p><span class="icon red-text">💬</span> <strong>WhatsApp:</strong> ${rawNumber
                            ? `<a href="${whatsappLink}" target="_blank"><span class="red-text">${rawNumber}</span></a>`
                            : "N/A"
                        }</p>
                                <p><a href="${googleMapLink}" target="_blank" class="map-link"><span class="icon red-text">🗺️</span> Open in Google Maps</a></p>

                            </td>
                            <td class="outlet-image">
                                <img src="${imagePath}" alt="Image of ${truncatedIdentifier}" class="outlet-img">
                            </td>
                        </tr>
                    `;
                })
                .join("");

            document.getElementById("tbody").innerHTML = tbodyContent;
        },
        error: function (xhr, status, error) {
            console.error("Error fetching outlets:", error);
        }
    });
}


function GetMenuCtg() {
    cartCount();

    if (menuCache) {
        renderMenuCtg(menuCache);
        return;
    }

    $.ajax({
        type: "GET",
        dataType: "json",
        url: "/SR/GetMenuCatg",
        success: function (data) {
            const menuData = data.response?.data || [];
            menuCache = menuData; // store in cache
            sessionStorage.setItem("menu_count", menuData.length);

            renderMenuCtg(menuData);
        },
        error: function (xhr, status, error) {
            console.error("XHR:", xhr, "Status:", status, "Error:", error);
        },
    });
}

function renderMenuCtg(menuData) {
    let htmlContent = "";

    menuData.forEach((item, index) => {
        const productCategory = item.productCategory || "Unknown Category";
        const description = item.productCategory$_identifier || "No Description";
        const menuImg = item.menuCatgImage || "";

        if (menuImg) {
            htmlContent += `
                <div class="col">
                    <div class="col-inner">
                        <div class="product-small box shop-catalogue has-hover box-normal box-text-bottom">
                            <div class="box-image">
                                <a href="/SecretRecipe/Menupack/${productCategory}" 
                                   aria-label="${description}" 
                                   onClick="storeSessionData('${productCategory}', '${description}')">
                                    <img loading="lazy" decoding="async" width="600" height="600" 
                                         src="data:image/png;base64,${menuImg}" 
                                         alt="${description}">
                                </a>
                            </div>
                            <div class="box-text text-center">
                                <p class="name product-title">
                                    <a href="#">${description}</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    });

    document.getElementById('rowshopctg').innerHTML = htmlContent;
}

function GetHomeMenuCtg() {
    cartCount();
    $.ajax({
        type: "GET",
        dataType: "json",
        url: "/SR/GetMenuCatg",
        success: function (data) {
            console.log("Response:", data);

            const menuData = data.response?.data || [];
            sessionStorage.setItem("menu_count", menuData.length);

            let htmlContent = `<div class="static-container">`;

            let seenCategories = new Set(); // Track unique categories

            for (let item of menuData) {
                const category = item?.productCategory || "Unknown Category";
                const description = item?.productCategory$_identifier || "No Description";
                const menuImg = item?.menuCatgImage || "";

                // Avoid duplicate categories
                if (seenCategories.has(category)) continue;
                seenCategories.add(category);

                htmlContent += `
                    <div class="static-item">
                        <a href="/SecretRecipe/CakeCategories">
                            <figure style="position: relative; margin: 0;">
                                <img src="data:image/png;base64,${menuImg}" alt="${category}" style="width: 100%; height: 250px; object-fit: cover; border-radius: 10px;">
                                <div class="description" style="position: absolute; bottom: 10px; left: 10px; color: white; background: white; padding: 10px; border-radius: 5px;">
                                    <h2 style="margin: 0; font-size: 16px;">${description}</h2>
                                </div>
                            </figure>
                        </a>
                    </div>
                `;
            }

            htmlContent += `</div>`;

            // Update DOM
            document.getElementById('honme_fea').innerHTML = htmlContent;
        },
        error: function (xhr, status, error) {
            console.error("XHR:", xhr);
            console.error("Status:", status);
            console.error("Error:", error);
        },
    });
}

function RedirectItem(id, package, price, hasCollection) {
    console.log("itemQty", id);
    localStorage.setItem("currentItemId", id);
    localStorage.setItem("currentItemPrice", parseFloat(price).toFixed(2));
    sessionStorage.setItem("currentPackage", package);
    sessionStorage.setItem("currentitemCollection", hasCollection)
    const storedId = localStorage.getItem("currentItemId");
    const storedPackage = sessionStorage.getItem("currentPackage");

    if (storedId && storedPackage) {
        console.log("currentItemId:", storedId);
        console.log("currentPackage:", storedPackage);
    } else {
        console.error("Failed to retrieve the currentItemId.");
    }
    //localStorage.setItem('currentItemId', storedId);
    localStorage.setItem('currentPackage', storedPackage);
    //return storedId,storedPackage;
    //window.location.href = '/Mannapot/ProductItem/' + id;
    window.location.href = '/SD/Product/' + id;

    //$('#price').text(price);
    console.log(localStorage.getItem("currentItemPrice"))
    if (!id) {
        console.error("Invalid ID provided.");
        return null;
    }
}

function GetHomeMenuCtg() {
    cartCount();

    if (menuCache) {
        renderHomeMenuCtg(menuCache);
        return;
    }

    $.ajax({
        type: "GET",
        dataType: "json",
        url: "/SR/GetMenuCatg",
        success: function (data) {
            const menuData = data.response?.data || [];
            menuCache = menuData;
            sessionStorage.setItem("menu_count", menuData.length);
            console.log("Home GetMenuCatg");
            renderHomeMenuCtg(menuData);
        },
        error: function (xhr, status, error) {
            console.error("XHR:", xhr, "Status:", status, "Error:", error);
        },
    });
}

function renderHomeMenuCtg(menuData) {
    let htmlContent = `<div class="static-container">`;
    let seenCategories = new Set();

    menuData.forEach(item => {
        const category = item?.productCategory || "Unknown Category";
        const description = item?.productCategory$_identifier || "No Description";
        const menuImg = item?.menuCatgImage || "";

        if (!menuImg || seenCategories.has(category)) return;
        seenCategories.add(category);

        htmlContent += `
            <div class="static-item">
                <a href="/SecretRecipe/CakeCategories?cat=${encodeURIComponent(category)}&desc=${encodeURIComponent(description)}">
                    <figure style="position: relative; margin: 0;">
                        <img src="data:image/png;base64,${menuImg}" alt="${category}" style="width: 100%; height: 250px; object-fit: cover; border-radius: 10px;">
                        <div class="description" style="position: absolute; bottom: 10px; left: 10px; background: white; padding: 10px; border-radius: 5px;">
                            <h2 style="margin: 0; font-size: 16px;">${description}</h2>
                        </div>
                    </figure>
                </a>
            </div>
        `;
    });

    htmlContent += `</div>`;
    document.getElementById('honme_fea').innerHTML = htmlContent;
}

//function GetHeader() {
//    GetDropDownMenu();
//}
//GetHeader();


//function GetCustomerFavProduct() {
//    cartCount();
//    $.ajax({
//        type: "GET",
//        dataType: "json",
//        url: `/SR/GetMenuPackage`,
//        success: function (data) {
//            try {
//                const responseData = data.data ? JSON.parse(data.data) : data;
//                const products = responseData.response.data.slice(0, 3);
//                const homeFav = document.getElementById("home_fav");
//                homeFav.innerHTML = "";

//                const title = document.createElement("h2");
//                const title1 = document.createElement("p");
//                title.innerText = "Our Bestsellers";
//                title1.innerText = "Halal-certified cakes using finest ingredients."
//                title.className = "text-center text-2xl font-bold text-red-600 mb-6";
//                title1.className = "text-center text-2xl font-bold text-red-600 mb-6";
//                title.style.color = "black";
//                title1.style.color = "black";
//                homeFav.appendChild(title);
//                homeFav.appendChild(title1);

//                const productContainer = document.createElement("div");
//                productContainer.className = "product-container";
//                homeFav.appendChild(productContainer);

//                products.forEach((itemData) => {
//                    if (!itemData) return; // Skip invalid items
//                    const {
//                        menuCatgImage: menuImg = "",
//                        menuPackage$_identifier: itemName = "No Description",
//                        unitPrice: itemPrice = "N/A",
//                    } = itemData;

//                    const imageSrc = /^data:image/.test(menuImg)
//                        ? menuImg
//                        : `data:image/png;base64,${menuImg}`;

//                    const card = document.createElement("div");
//                    card.className = "product-card";
//                    card.innerHTML = `
//                        <div class="img-wrapper">
//                            <img src="${imageSrc}" alt="${itemName}" loading="lazy">
//                        </div>
//                        <h3>${itemName}</h3>
//                        <p>From $${parseFloat(itemPrice).toFixed(2)}</p>
//                        <button>Details</button>
//                    `;
//                    productContainer.appendChild(card);
//                });

//                // Inject styles only once
//                if (!document.getElementById("product-style")) {
//                    const style = document.createElement("style");
//                    style.id = "product-style";
//                    style.innerHTML = `
//                        .product-container {
//                            display: flex;
//                            flex-wrap: wrap;
//                            justify-content: center;
//                            gap: 10px;
//                        }
//                        .product-card {
//                            max-width: 320px;
//                            width: 100%;
//                            border: 1px solid #ddd;
//                            border-radius: 10px;
//                            padding: 15px;
//                            box-shadow: 2px 2px 10px rgba(0,0,0,0.1);
//                            background-color: white;
//                            text-align: center;
//                            transition: transform 0.3s ease-in-out;
//                            flex: 0 1 calc(33.33% - 20px); /* default: 3 per row */
//                        }
//                        .product-card:hover {
//                            transform: scale(1.05);
//                        }
//                        .product-card .img-wrapper {
//                            margin-bottom: 10px;
//                            background-color: #f8f8f8;
//                            padding: 10px;
//                            border-radius: 10px;
//                        }
//                        .product-card img {
//                            max-width: 80%;
//                            object-fit: cover;
//                            border-radius: 10px;
//                        }
//                        .product-card h3 {
//                            font-size: 15px;
//                            margin-bottom: 5px;
//                            font-weight: bold;
//                        }
//                        .product-card p {
//                            font-size: 16px;
//                            color: black;
//                        }
//                        .product-card button {
//                            background-color: red;
//                            color: white;
//                            border: none;
//                            padding: 10px 20px;
//                            cursor: pointer;
//                            border-radius: 5px;
//                            font-weight: bold;
//                            margin-top: 10px;
//                        }
//                        @media (max-width: 768px) {
//                            .product-card {
//                                flex: 0 1 calc(50% - 10px); /* 2 per row on mobile */
//                                font-size 12px;
//                                color : black;
//                            }

//                            .product-card h3 {
//                                font-size: 12px;
//                                margin-bottom: 5px;
//                                font-weight: bold;
//                            }

//                             .product-card p {
//                                font-size: 12px;
//                                color: black;
//                            }
//                        }
//                    `;
//                    document.head.appendChild(style);
//                }
//            } catch (error) {
//                console.error("Error processing menu data:", error);
//            }
//        },
//        error: function (xhr, status, error) {
//            console.error("AJAX Request Failed:", { xhr, status, error });
//        }
//    });
//}

// Add mobile swipe support


function GetBestSeller() {
    $.ajax({
        type: "GET",
        dataType: "json",
        url: `/SR/GetMenuPackage`,
        success: function (data) {
            try {
                const responseData = data.data ? JSON.parse(data.data) : data;

                // Filter out Cooler Bag and take first 6 products
                const allProducts = responseData.response.data
                    .filter(item => item.packageName !== "Cooler Bag")
                    .slice(0, 6);

                const homeFav = document.getElementById("home_fav");
                homeFav.innerHTML = "";

                // Enhanced CSS styles
                const styleTag = document.createElement("style");
                styleTag.innerHTML = `
     
                    .bestsellers-title {
                        text-align: center;
                        margin-bottom: 0.75rem;
                        letter-spacing: -0.5px;
                        position: relative;
                        display: inline-block;
                        left: 50%;
                        transform: translateX(-50%);
                    }
                    
                    .bestsellers-title:after {
                        content: '';
                        position: absolute;
                        bottom: -8px;
                        left: 0;
                        width: 100%;
                        height: 3px;
                        border-radius: 3px;
                    }
                    
                    .bestsellers-subtitle {
                        text-align: center;
                        font-size: 1.4rem;
                        line-height: 1.6;
                        max-width: 700px;
                        margin-left: auto;
                        margin-right: auto;
                        color : #636e72;
                    }
                    
                    /* Carousel Container */
                    .carousel-container {
                        max-width: 1280px;
                        margin: 0 auto;
                        padding: 2rem 1.5rem;
                        position: relative;
                        font-family: 'Segoe UI', Roboto, sans-serif;
                        overflow: hidden;
                    }
                    
                    .carousel-slide {
                        display: flex;
                        transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                        will-change: transform;
                    }
                    
                    .product-section {
                        flex: 0 0 100%;
                        box-sizing: border-box;
                        padding: 0 1rem;
                    }
                    
                    /* Products Grid */
                    .products-container {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 1.5rem;
                        margin: 6rem;
                    }
                    
                    /* Product Card */
                    .product {
                        transition: all 0.4s ease;
                        overflow: hidden;
                        position: relative;
                        height: 100%;
                    }
                    
                  
                    
                    .product-img-container {
                        position: relative;
                        overflow: hidden;
                        height: 220px;
                    }
                    
                    .product-img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                        transition: transform 0.5s ease;
                    }
                    
                    .product:hover .product-img {
                        transform: scale(1.05);
                    }
                    
                    .product-content {
                        padding: 1.5rem;
                        flex-grow: 1;
                        display: flex;
                        flex-direction: column;
                        background : #fff6e8;
                    }
                    
                    .product-name {
                            text-align: center;

                        font-weight: 600;
                        margin-bottom: 0.75rem;
                        font-size: 1.5rem;
                        color: #2d3436;
                        line-height: 1.4;
                            font-family: 'Playfair Display', serif;
                    }
                    
                    .product-price {
                        color: #e74c3c;
                        margin-bottom: 1.25rem;
                        font-weight: 700;
                        font-size: 1.3rem;
                        margin-top: auto;
                        text-align : center;
                    }
                    
                    .details-btn {
                        color: white;
                        border: none;
                        padding: 0.75rem 1.5rem;
                        border-radius: 50px;
                        cursor: pointer;
                        font-weight: 600;
                        transition: all 0.3s ease;
                        text-transform: uppercase;
                        font-size: 14px;
                        letter-spacing: 0.5px;
                        align-self: center;
                        width: 100px;
                        font-family: 'Segoe UI', Roboto, sans-serif;
                    }
                    
                    .details-btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px rgba(231, 76, 60, 0.3);
                        background-color: white;
                        color: red;
                    }
                    
                    /* Navigation Arrows */
                    .carousel-nav {
                        position: absolute;
                        top: 50%;
                        width: calc(100% - 4rem);
                        left: 2rem;
                        transform: translateY(-50%);
                        display: flex;
                        justify-content: space-between;
                        pointer-events: none;
                        z-index: 10;
                    }
                    
                    .carousel-nav button {
                        pointer-events: all;
                        background: white;
                        border: none;
                        width: 48px;
                        height: 48px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                        cursor: pointer;
                        transition: all 0.3s ease;
                    }
                    
                    .carousel-nav button:hover {
                        transform: scale(1.1);
                        background: #e74c3c;
                    }
                    
                    .carousel-nav button:hover svg {
                        stroke: white;
                    }
                    
                    .carousel-nav button svg {
                        width: 24px;
                        height: 24px;
                        stroke: #e74c3c;
                        stroke-width: 2;
                    }
                    
                    /* Desktop Slider Dots */
                    .desktop-dots-container {
                        display: flex;
                        justify-content: center;
                        gap: 10px;
                        margin-top: 1.5rem;
                        padding : 0.5rem;
                    }
                    
                    .desktop-dot {
                        width: 11px;
                        height: 11px;
                        border-radius: 50%;
                        background-color: #dfe6e9;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    }
                    
                    .desktop-dot.active {
                        background-color: #e74c3c;
                        transform: scale(1.2);
                    }
                    
                    /* Mobile Slider Dots Container 1 */
                    .mobile-slider-dots-container1 {
                        display: none;
                        justify-content: center;
                        gap: 6px;
                        margin-top: 1.5rem;
                    }
                    
                    .mobile-dot1 {
                        width: 10px;
                        height: 10px;
                        border-radius: 50%;
                        background-color: #dfe6e9;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    }
                    
                    .mobile-dot1.active {
                        background-color: #e74c3c;
                        transform: scale(1.2);
                    }
                    
                    /* Badge for Special Items */
                    .product-badge {
                        position: absolute;
                        top: 1rem;
                        right: 1rem;
                        background: #e74c3c;
                        color: white;
                        padding: 0.25rem 0.75rem;
                        border-radius: 50px;
                        font-size: 14px;
                        font-weight: 700;
                        z-index: 2;
                    }
                    
                    /* Responsive Styles */
                    @media (max-width: 1024px) {
                       

                        .product-img-container {
                            height: 200px;
                        }
                    }
                    
                    @media (max-width: 768px) {
                        .bestsellers-container {
                            padding: 1.5rem 1rem;
                        }
                        
                        .bestsellers-title {
                            font-size: 1.8rem;
                        }
                        
                        .carousel-container {
                            padding: 0;
                            display: none;
                        }
                        
                        .products-container {
                            grid-template-columns: repeat(2, 1fr);
                            gap: 1rem;
                        }
                        
                        .product-section {
                            padding: 0 0;
                        }
                        
                        .carousel-nav button {
                            display: none;
                        }
                        
                        .desktop-dots-container {
                            display: none;
                        }
                        
                        .mobile-slider-dots-container1 {
                            display: flex;
                                    padding: 2.5rem;
                        }
                    }
                    
                    @media (max-width: 480px) {
                        .products-container {
                            grid-template-columns: repeat(1, 1fr);
                            gap: 1.25rem;
                            margin: 0;
                        }

                        .product-img-container {
                            height: 200px;
                        }
                        
                        .product-content {
                            padding: 1.25rem;
                        }
                        
                        .bestsellers-title {
                            font-size: 30px;
                        }
                        
                        .bestsellers-subtitle {
                            font-size: 1.4rem;
                            margin-bottom: 2rem;
                        }
                    }

                    /* Mobile-only Carousel */
                    .mobile-carousel-container {
                        display: none;
                    }

                    .mobile-carousel-slide {
                        display: flex;
                        transition: transform 0.6s ease;
                        will-change: transform;
                    }

                    .mobile-product-slide {
                        flex: 0 0 100%;
                        box-sizing: border-box;
                        padding: 5px 2rem;
                    }
                    @media (max-width: 768px) {
                                .mobile-carousel-container {
                            display: block;
                            overflow: hidden;
                            position: relative;
                        }

                        .slide-wrapper {
                                flex: 0 0 100%;
                                justify-content: center;
                                padding: 1rem 3rem;
                            }

                            .slide-item {
                                flex: 0 0 100%;
                                max-width: 100%;
                            }
                    }
                `;
                document.head.appendChild(styleTag);

                // Create container
                const container = document.createElement("div");
                container.className = "bestsellers-container";
                homeFav.appendChild(container);

                // Title & subtitle
                const title = document.createElement("h1");
                title.className = "bestsellers-title";
                title.textContent = "You Might Also Like";
                container.appendChild(title);

                const subtitle = document.createElement("p");
                subtitle.className = "bestsellers-subtitle";
                subtitle.textContent = "Our BestSellers";
                container.appendChild(subtitle);

                // Desktop Carousel
                const carouselContainer = document.createElement("div");
                carouselContainer.className = "carousel-container";
                container.appendChild(carouselContainer);

                const carouselSlide = document.createElement("div");
                carouselSlide.className = "carousel-slide";
                carouselContainer.appendChild(carouselSlide);

                // Group products into sections
                const productSections = [];
                for (let i = 0; i < allProducts.length; i += 3) {
                    productSections.push(allProducts.slice(i, i + 3));
                }

                // Create product sections
                productSections.forEach((sectionProducts, sectionIndex) => {
                    const section = document.createElement("div");
                    section.className = "product-section";

                    const productsContainer = document.createElement("div");
                    productsContainer.className = "products-container";
                    section.appendChild(productsContainer);

                    sectionProducts.forEach((itemData, productIndex) => {

                        const product = document.createElement("div");
                        product.className = "product";
                        product.style.boxShadow = "5px 5px 10px 0px rgba(0,0,0,.35)";
                        product.style.borderRadius = "10px";

                        if (itemData.bestseller === true) {
                            const badge = document.createElement("span");
                            badge.textContent = "Popular";
                            badge.style.position = "absolute";
                            badge.style.top = "0.45rem";
                            badge.style.right = "0.2rem";
                            badge.style.backgroundColor = "rgb(245, 111, 0)";
                            badge.style.color = "white";
                            badge.style.fontSize = "12px";
                            badge.style.fontWeight = "bold";
                            badge.style.padding = "0.25rem 0.6rem";
                            badge.style.borderRadius = "9999px"; // Fully rounded
                            badge.style.zIndex = "2";

                            product.appendChild(badge);
                        }


                        product.style.cursor = "pointer";
                        product.addEventListener("click", function (e) {
                            // Avoid triggering when button is clicked (so it doesn't double-fire)
                            if (e.target.closest(".details-btn")) return;

                            sessionStorage.setItem("menuPackage", itemData.id);
                            location.href = `/SecretRecipe/Product/${itemData.id}`;
                        });

                        const imgContainer = document.createElement("div");
                        imgContainer.className = "product-img-container";

                        const productImg = document.createElement("img");
                        productImg.className = "product-img";
                        productImg.alt = itemData.name || "Delicious Cake";
                        productImg.loading = "lazy";

                        // Use menuCatgImage or fallback to image
                        const imageId = itemData.menuCatgImage || itemData.image;

                        // Set the image source with fallback
                        productImg.src = imageId
                            ? getImageUrl(imageId)
                            : "https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80";



                        imgContainer.appendChild(productImg);
                        product.appendChild(imgContainer);

                        const productContent = document.createElement("div");
                        productContent.className = "product-content";

                        const productName = document.createElement("div");
                        productName.className = "product-name";
                        productName.textContent = itemData.packageName || "Special Cake";

                        const productPrice = document.createElement("div");
                        productPrice.className = "product-price";
                        productPrice.textContent = `From SGD$ ${parseFloat(itemData.unitPrice || 0).toFixed(2)}`;
                        const detailsBtn = document.createElement("button");
                        detailsBtn.className = "details-btn";
                        detailsBtn.textContent = "Details";
                        detailsBtn.setAttribute("onclick", `sessionStorage.setItem('menuPackage','${itemData.id}');location.href='/SecretRecipe/Product/${itemData.id}';`);
                        productContent.appendChild(productName);
                        productContent.appendChild(productPrice);
                        productContent.appendChild(detailsBtn);
                        product.appendChild(productContent);

                        productsContainer.appendChild(product);
                    });

                    carouselSlide.appendChild(section);
                });

                // Desktop navigation buttons
                const navButtons = document.createElement("div");
                navButtons.className = "carousel-nav";
                carouselContainer.appendChild(navButtons);

                const prevButton = document.createElement("button");
                prevButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
                prevButton.onclick = () => prevSlide();
                prevButton.setAttribute("aria-label", "Previous slide");
                navButtons.appendChild(prevButton);

                const nextButton = document.createElement("button");
                nextButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M9 18L15 12L9 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
                nextButton.onclick = () => nextSlide();
                nextButton.setAttribute("aria-label", "Next slide");
                navButtons.appendChild(nextButton);

                // Desktop slider dots
                const desktopDotsContainer = document.createElement("div");
                desktopDotsContainer.className = "desktop-dots-container";
                carouselContainer.appendChild(desktopDotsContainer);

                const desktopDots = [];
                productSections.forEach((_, index) => {
                    const dot = document.createElement("span");
                    dot.className = "desktop-dot";
                    if (index === 0) dot.classList.add("active");
                    dot.onclick = () => goToSlide(index);
                    desktopDotsContainer.appendChild(dot);
                    desktopDots.push(dot);
                });

                // Mobile Carousel
                const mobileCarouselContainer = document.createElement("div");
                mobileCarouselContainer.className = "mobile-carousel-container";
                container.appendChild(mobileCarouselContainer);

                const mobileCarouselSlide = document.createElement("div");
                mobileCarouselSlide.className = "mobile-carousel-slide";
                mobileCarouselContainer.appendChild(mobileCarouselSlide);

                // Create mobile slides - also filter out Cooler Bag for mobile
                const filteredMobileProducts = allProducts.filter(item => item.packageName !== "Cooler Bag");
                filteredMobileProducts.forEach((itemData, index) => {
                    const mobileSlide = document.createElement("div");
                    mobileSlide.className = "mobile-product-slide";

                    const product = document.createElement("div");
                    product.className = "product";
                    product.style.boxShadow = "5px 5px 10px 0px rgba(0,0,0,.35)";
                    product.style.borderRadius = "10px";

                    if (itemData.bestseller === true) {
                        const badge = document.createElement("span");
                        badge.textContent = "Popular";
                        badge.style.position = "absolute";
                        badge.style.top = "0.45rem";
                        badge.style.right = "0.2rem";
                        badge.style.backgroundColor = "rgb(245, 111, 0)";
                        badge.style.color = "white";
                        badge.style.fontSize = "12px";
                        badge.style.fontWeight = "bold";
                        badge.style.padding = "0.25rem 0.6rem";
                        badge.style.borderRadius = "9999px";
                        badge.style.zIndex = "2";

                        product.appendChild(badge);
                    }


                    const imgContainer = document.createElement("div");
                    imgContainer.className = "product-img-container";

                    const productImg = document.createElement("img");
                    productImg.className = "product-img";
                    productImg.alt = itemData.name || "Delicious Cake";
                    productImg.loading = "lazy";

                    // Use menuCatgImage or fallback to image
                    const imageId = itemData.menuCatgImage || itemData.image;

                    // Set the image source with fallback
                    productImg.src = imageId
                        ? getImageUrl(imageId)
                        : "https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80";


                    imgContainer.appendChild(productImg);
                    product.appendChild(imgContainer);

                    const productContent = document.createElement("div");
                    productContent.className = "product-content";

                    const productName = document.createElement("div");
                    productName.className = "product-name";
                    productName.textContent = itemData.packageName || "Special Cake";

                    const productPrice = document.createElement("div");
                    productPrice.className = "product-price";
                    productPrice.textContent = `From SGD$ ${parseFloat(itemData.unitPrice || 0).toFixed(2)}`;

                    const detailsBtn = document.createElement("button");
                    detailsBtn.className = "details-btn";
                    detailsBtn.textContent = "Details";
                    detailsBtn.setAttribute("onclick", `sessionStorage.setItem('menuPackage','${itemData.id}');location.href='/SecretRecipe/Product/${itemData.id}';`);

                    productContent.appendChild(productName);
                    productContent.appendChild(productPrice);
                    productContent.appendChild(detailsBtn);
                    product.appendChild(productContent);

                    mobileSlide.appendChild(product);
                    mobileCarouselSlide.appendChild(mobileSlide);
                });

                // Mobile slider dots container 1 - use filtered products length
                const mobileSliderDots1 = document.createElement("div");
                mobileSliderDots1.className = "mobile-slider-dots-container1";
                container.appendChild(mobileSliderDots1);

                const mobileDots1 = [];
                filteredMobileProducts.forEach((_, index) => {
                    const dot = document.createElement("span");
                    dot.className = "mobile-dot1";
                    if (index === 0) dot.classList.add("active");
                    dot.onclick = () => {
                        mobileCurrentIndex = index;
                        updateMobileCarousel();
                    };
                    mobileSliderDots1.appendChild(dot);
                    mobileDots1.push(dot);
                });

                // Carousel control variables
                let currentSlide = 0;
                let mobileCurrentIndex = 0;
                let slideInterval;

                // Desktop carousel functions
                function updateCarousel() {
                    const offset = -currentSlide * 100;
                    carouselSlide.style.transform = `translateX(${offset}%)`;
                    desktopDots.forEach((dot, index) => {
                        dot.classList.toggle("active", index === currentSlide);
                    });
                }

                function goToSlide(index) {
                    currentSlide = index;
                    updateCarousel();
                }

                function nextSlide() {
                    currentSlide = (currentSlide + 1) % productSections.length;
                    updateCarousel();
                }

                function prevSlide() {
                    currentSlide = (currentSlide - 1 + productSections.length) % productSections.length;
                    updateCarousel();
                }

                // Mobile carousel functions
                function updateMobileCarousel() {
                    const offset = -mobileCurrentIndex * 100;
                    mobileCarouselSlide.style.transform = `translateX(${offset}%)`;
                    mobileDots1.forEach((dot, index) => {
                        dot.classList.toggle("active", index === mobileCurrentIndex);
                    });
                }

                // Swipe handling for mobile - use filtered products length
                let mobileStartX = 0;
                let mobileEndX = 0;

                mobileCarouselContainer.addEventListener("touchstart", (e) => {
                    mobileStartX = e.touches[0].clientX;
                }, { passive: true });

                mobileCarouselContainer.addEventListener("touchend", (e) => {
                    mobileEndX = e.changedTouches[0].clientX;
                    const delta = mobileEndX - mobileStartX;
                    if (Math.abs(delta) > 50) {
                        if (delta < 0) {
                            mobileCurrentIndex = (mobileCurrentIndex + 1) % filteredMobileProducts.length;
                        } else {
                            mobileCurrentIndex = (mobileCurrentIndex - 1 + filteredMobileProducts.length) % filteredMobileProducts.length;
                        }
                        updateMobileCarousel();
                    }
                }, { passive: true });

                // Initialize carousels
                updateCarousel();
                updateMobileCarousel();

                // Auto-advance slides
                function startAutoSlide() {
                    slideInterval = setInterval(nextSlide, 5000);
                }

                function pauseAutoSlide() {
                    clearInterval(slideInterval);
                }

                //startAutoSlide();

                // Pause on hover
                carouselContainer.addEventListener('mouseenter', pauseAutoSlide);
                carouselContainer.addEventListener('mouseleave', startAutoSlide);

                // Handle window resize
                let resizeTimer;
                window.addEventListener('resize', function () {
                    clearTimeout(resizeTimer);
                    pauseAutoSlide();
                    resizeTimer = setTimeout(function () {
                        updateCarousel();
                        updateMobileCarousel();
                        //startAutoSlide();
                    }, 250);
                });

                // Touch support for desktop
                let touchStartX = 0;
                let touchEndX = 0;

                carouselContainer.addEventListener('touchstart', (e) => {
                    touchStartX = e.changedTouches[0].screenX;
                    pauseAutoSlide();
                }, { passive: true });

                carouselContainer.addEventListener('touchend', (e) => {
                    touchEndX = e.changedTouches[0].screenX;
                    handleSwipe();
                    startAutoSlide();
                }, { passive: true });

                function handleSwipe() {
                    const threshold = 50;
                    if (touchStartX - touchEndX > threshold) {
                        nextSlide();
                    } else if (touchEndX - touchStartX > threshold) {
                        prevSlide();
                    }
                }

            } catch (error) {
                console.error("Error processing menu data:", error);
            }
        },
        error: function (xhr, status, error) {
            console.error("AJAX Request Failed:", { xhr, status, error });
        }
    });
}
function GetCustomerFavProduct() {
    cartCount();
    GetPromotion();

    $.ajax({
        type: "GET",
        dataType: "json",
        url: `/SR/GetMenuPackage`,
        success: function (data) {
            try {
                const responseData = data.data ? JSON.parse(data.data) : data;
                const bestSellers = responseData.response.data.filter(item => item.bestseller === true);
                const allProducts = bestSellers.slice(0, 6);
                // Show loading state
                showLoadingState();

                // Pre-load all images before rendering
                preloadImages(allProducts).then(() => {
                    renderCarousel(allProducts);
                }).catch((error) => {
                    console.error("Error loading images:", error);
                    // Render anyway with fallback images
                    renderCarousel(allProducts);
                });

            } catch (error) {
                console.error("Error processing menu data:", error);
                hideLoadingState();
            }
        },
        error: function (xhr, status, error) {
            console.error("AJAX Request Failed:", { xhr, status, error });
            hideLoadingState();
        }
    });
}

// Show loading state
function showLoadingState() {
    const homeFav = document.getElementById("home_fav");
    homeFav.innerHTML = `
        <div class="loading-container" style="
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 400px;
            flex-direction: column;
            gap: 24px;
        ">
            <div class="loader-wrapper" style="
                position: relative;
                width: 80px;
                height: 80px;
            ">
                <div class="spinner-ring" style="
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border: 3px solid transparent;
                    border-top: 3px solid #e74c3c;
                    border-right: 3px solid #e74c3c;
                    border-radius: 50%;
                    animation: spin 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
                "></div>
                <div class="spinner-ring" style="
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border: 3px solid transparent;
                    border-bottom: 3px solid #ff6b6b;
                    border-left: 3px solid #ff6b6b;
                    border-radius: 50%;
                    animation: spin-reverse 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
                    animation-delay: -0.6s;
                "></div>
                <div class="spinner-core" style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 12px;
                    height: 12px;
                    background: #e74c3c;
                    border-radius: 50%;
                    animation: pulse 1.2s ease-in-out infinite;
                "></div>
            </div>
            
            <div class="loading-text" style="text-align: center;">
                <p style="
                    color: #2d3436;
                    font-size: 18px;
                    font-weight: 600;
                    margin: 0 0 8px 0;
                    animation: fadeInOut 2s ease-in-out infinite;
                ">Loading our bestsellers</p>
                <div class="loading-dots" style="
                    display: flex;
                    gap: 6px;
                    justify-content: center;
                ">
                    <span style="
                        width: 8px;
                        height: 8px;
                        background: #e74c3c;
                        border-radius: 50%;
                        animation: bounce 1.4s ease-in-out infinite;
                    "></span>
                    <span style="
                        width: 8px;
                        height: 8px;
                        background: #e74c3c;
                        border-radius: 50%;
                        animation: bounce 1.4s ease-in-out 0.2s infinite;
                    "></span>
                    <span style="
                        width: 8px;
                        height: 8px;
                        background: #e74c3c;
                        border-radius: 50%;
                        animation: bounce 1.4s ease-in-out 0.4s infinite;
                    "></span>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            @keyframes spin-reverse {
                0% { transform: rotate(360deg); }
                100% { transform: rotate(0deg); }
            }
            
            @keyframes pulse {
                0%, 100% { 
                    transform: translate(-50%, -50%) scale(1);
                    opacity: 1;
                }
                50% { 
                    transform: translate(-50%, -50%) scale(1.5);
                    opacity: 0.5;
                }
            }
            
            @keyframes fadeInOut {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
            
            @keyframes bounce {
                0%, 80%, 100% { 
                    transform: translateY(0);
                }
                40% { 
                    transform: translateY(-12px);
                }
            }
        </style>
    `;
}

// Hide loading state
function hideLoadingState() {
    const loadingContainer = document.querySelector('.loading-container');
    if (loadingContainer) {
        loadingContainer.remove();
    }
}

// Pre-load all images
function preloadImages(products) {
    return new Promise((resolve, reject) => {
        const imagePromises = products.map(item => {
            return new Promise((resolveImg, rejectImg) => {
                const img = new Image();
                const imageId = item.menuCatgImage || item.image;
                const imgSrc = imageId
                    ? getImageUrl(imageId)
                    : "https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80";

                img.onload = () => resolveImg(imgSrc);
                img.onerror = () => {
                    // Use fallback image on error
                    const fallbackImg = new Image();
                    fallbackImg.onload = () => resolveImg("https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80");
                    fallbackImg.onerror = () => rejectImg(new Error(`Failed to load image for ${item.packageName}`));
                    fallbackImg.src = "https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80";
                };
                img.src = imgSrc;
            });
        });

        Promise.allSettled(imagePromises).then((results) => {
            const loadedImages = results.filter(result => result.status === 'fulfilled');
            if (loadedImages.length > 0) {
                resolve(results);
            } else {
                reject(new Error('No images could be loaded'));
            }
        });
    });
}

// Main render function
function renderCarousel(allProducts) {
    const homeFav = document.getElementById("home_fav");

    // Clear loading state and any existing content
    homeFav.innerHTML = "";

    // Enhanced CSS styles with fade-in animation
    const styleTag = document.createElement("style");
    styleTag.innerHTML = `
        /* Base Styles */
        .bestsellers-container {
            max-width: 1280px;
            margin: 0 auto;
            padding: 2rem 1.5rem;
            position: relative;
            font-family: 'Segoe UI', Roboto, sans-serif;
            opacity: 0;
            animation: fadeInUp 0.8s ease forwards;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .bestsellers-title {
            text-align: center;
            margin-bottom: 0.75rem;
            letter-spacing: -0.5px;
            position: relative;
            display: inline-block;
            left: 50%;
            transform: translateX(-50%);
        }
        
        .bestsellers-title:after {
            content: '';
            position: absolute;
            bottom: -8px;
            left: 0;
            width: 100%;
            height: 3px;
            border-radius: 3px;
        }
        
        .bestsellers-subtitle {
            text-align: center;
            margin-bottom: 2.5rem;
            font-size: 1.4rem;
            line-height: 1.6;
            max-width: 700px;
            margin-left: auto;
            margin-right: auto;
            color: #636e72;
        }
        
        /* Carousel Container */
        .carousel-container {
            position: relative;
            overflow: hidden;
            margin-bottom: 2rem;
            padding: 0 2rem;
        }
        
        .carousel-slide {
            display: flex;
            transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            will-change: transform;
        }
        
        .product-section {
            flex: 0 0 100%;
            box-sizing: border-box;
            padding: 0 1rem;
        }
        
        /* Products Grid */
        .products-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.5rem;
            margin: 6rem;
        }
        
        /* Product Card */
        .product {
            border-radius: 12px;
            background: white;
            text-align: center;
            transition: all 0.4s ease;
            box-shadow: 5px 5px 5px rgba(0,0,0,0.08);
            overflow: hidden;
            position: relative;
            display: flex;
            flex-direction: column;
            height: 100%;
            opacity: 0;
            animation: slideInProduct 0.6s ease forwards;
        }
        
        @keyframes slideInProduct {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .product:nth-child(1) { animation-delay: 0.1s; }
        .product:nth-child(2) { animation-delay: 0.2s; }
        .product:nth-child(3) { animation-delay: 0.3s; }
        
        .product:hover {
            transform: translateY(-8px);
            box-shadow: 0 15px 30px rgba(0,0,0,0.12);
        }
        
        .product-img-container {
            position: relative;
            overflow: hidden;
            height: 220px;
            background: #f8f9fa;
        }
        
        .product-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s ease;
            opacity: 0;
            animation: fadeInImage 0.5s ease forwards;
        }
        
        @keyframes fadeInImage {
            to {
                opacity: 1;
            }
        }
        
        .product:hover .product-img {
            transform: scale(1.05);
        }
        
        .product-content {
            padding: 1.5rem;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            background: #fff6e8;
        }
        
        .product-name {
            text-align: center;
            font-weight: 600;
            margin-bottom: 0.75rem;
            font-size: 1.5rem;
            color: #2d3436;
            line-height: 1.4;
            font-family: 'Playfair Display', serif;
        }
        
        .product-price {
            color: #e74c3c;
            margin-bottom: 1.25rem;
            font-weight: 700;
            font-size: 1.3rem;
            margin-top: auto;
        }
        
        .details-btn {
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 50px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            text-transform: uppercase;
            font-size: 14px;
            letter-spacing: 0.5px;
            align-self: center;
            width: 100px;
            font-family: 'Segoe UI', Roboto, sans-serif;
            background-color: #e74c3c;
        }
        
        .details-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(231, 76, 60, 0.3);
            background-color: white;
            color: #e74c3c;
        }
        
        /* Navigation Arrows */
        .carousel-nav {
            position: absolute;
            top: 50%;
            width: calc(100% - 4rem);
            left: 2rem;
            transform: translateY(-50%);
            display: flex;
            justify-content: space-between;
            pointer-events: none;
            z-index: 10;
        }
        
        .carousel-nav button {
            pointer-events: all;
            background: white;
            border: none;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .carousel-nav button:hover {
            transform: scale(1.1);
            background: #e74c3c;
        }
        
        .carousel-nav button:hover svg {
            stroke: white;
        }
        
        .carousel-nav button svg {
            width: 24px;
            height: 24px;
            stroke: #e74c3c;
            stroke-width: 2;
        }
        
        /* Desktop Slider Dots */
        .desktop-dots-container {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-top: 1.5rem;
            padding: 0.5rem;
        }
        
        .desktop-dot {
            width: 11px;
            height: 11px;
            border-radius: 50%;
            background-color: #dfe6e9;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .desktop-dot.active {
            background-color: #e74c3c;
            transform: scale(1.2);
        }
        
        /* Mobile Slider Dots Container 1 */
        .mobile-slider-dots-container1 {
            display: none;
            justify-content: center;
            gap: 10px;
            margin-top: 1.5rem;
        }
        
        .mobile-dot1 {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: #dfe6e9;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .mobile-dot1.active {
            background-color: #e74c3c;
            transform: scale(1.2);
        }
        
        /* Badge for Special Items */
        .product-badge {
            position: absolute;
            top: 1rem;
            right: 1rem;
            background: #e74c3c;
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 50px;
            font-size: 14px;
            font-weight: 700;
            z-index: 2;
        }
        
        /* Mobile-only Carousel */
        .mobile-carousel-container {
            display: none;
        }

        .mobile-carousel-slide {
            display: flex;
            transition: transform 0.6s ease;
            will-change: transform;
        }

        .mobile-product-slide {
            flex: 0 0 100%;
            box-sizing: border-box;
            padding: 5px 2rem;
        }
        
        /* Error state */
        .image-error {
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8f9fa;
            color: #6c757d;
            font-size: 14px;
        }
        
        /* Responsive Styles */
        @media (max-width: 1024px) {
            .product-img-container {
                height: 200px;
            }
        }
        
        @media (max-width: 768px) {
            .bestsellers-container {
                padding: 1.5rem 1rem;
            }
            
            .bestsellers-title {
                font-size: 1.8rem;
            }
            
            .carousel-container {
                padding: 0;
                display: none;
            }
            
            .products-container {
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
            }
            
            .product-section {
                padding: 0 0;
            }
            
            .carousel-nav button {
                display: none;
            }
            
            .desktop-dots-container {
                display: none;
            }
            
            .mobile-slider-dots-container1 {
                display: flex;
                padding: 2.5rem;
            }
            
            .mobile-carousel-container {
                display: block;
                overflow: hidden;
                position: relative;
            }

            .slide-wrapper {
                flex: 0 0 100%;
                justify-content: center;
                padding: 1rem 10px;
                display: block;
                height: auto;
                width: auto;
            }

            .slide-item {
                flex: 0 0 100%;
                max-width: 100%;
                border-radius: 12px;
                border-radius: 12px;
                background: white;
                text-align: center;
                transition: all 0.4s ease;
                box-shadow: 5px 5px 5px rgba(0, 0, 0, 0.08);
                overflow: hidden;
                position: relative;
                display: flex;
                flex-direction: column;
            }

            .slider-container {
                position: relative;
                overflow: hidden;
                margin: 2rem 0;
                border-radius: 12px;
                padding: 0 0.5rem;
                box-sizing: border-box;
            }
        }
        
        @media (max-width: 480px) {
            .products-container {
                grid-template-columns: repeat(1, 1fr);
                gap: 1.25rem;
                margin: 0;
            }

            .product-img-container {
                height: 200px;
            }
            
            .product-content {
                padding: 1.25rem;
            }
            
            .bestsellers-title {
                font-size: 30px;
            }
            
            .bestsellers-subtitle {
                font-size: 1.4rem;
                margin-bottom: 2rem;
            }
        }
    `;
    document.head.appendChild(styleTag);

    // Create container
    const container = document.createElement("div");
    container.className = "bestsellers-container";
    homeFav.appendChild(container);

    // Title & subtitle
    const title = document.createElement("h1");
    title.className = "bestsellers-title";
    title.textContent = "Our Bestsellers";
    container.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "bestsellers-subtitle";
    subtitle.textContent = "Halal-certified cakes made with the finest ingredients, crafted with love for every celebration.";
    container.appendChild(subtitle);

    // Desktop Carousel
    const carouselContainer = document.createElement("div");
    carouselContainer.className = "carousel-container";
    container.appendChild(carouselContainer);

    const carouselSlide = document.createElement("div");
    carouselSlide.className = "carousel-slide";
    carouselContainer.appendChild(carouselSlide);

    // Group products into sections
    const productSections = [];
    for (let i = 0; i < allProducts.length; i += 3) {
        productSections.push(allProducts.slice(i, i + 3));
    }

    // Create product sections
    productSections.forEach((sectionProducts, sectionIndex) => {
        const section = document.createElement("div");
        section.className = "product-section";

        const productsContainer = document.createElement("div");
        productsContainer.className = "products-container";
        section.appendChild(productsContainer);

        sectionProducts.forEach((itemData, productIndex) => {
            const product = createProductCard(itemData);
            productsContainer.appendChild(product);
        });

        carouselSlide.appendChild(section);
    });

    // Desktop navigation buttons
    const navButtons = document.createElement("div");
    navButtons.className = "carousel-nav";
    carouselContainer.appendChild(navButtons);

    const prevButton = document.createElement("button");
    prevButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    prevButton.setAttribute("aria-label", "Previous slide");
    navButtons.appendChild(prevButton);

    const nextButton = document.createElement("button");
    nextButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M9 18L15 12L9 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    nextButton.setAttribute("aria-label", "Next slide");
    navButtons.appendChild(nextButton);

    // Desktop slider dots
    const desktopDotsContainer = document.createElement("div");
    desktopDotsContainer.className = "desktop-dots-container";
    carouselContainer.appendChild(desktopDotsContainer);

    const desktopDots = [];
    productSections.forEach((_, index) => {
        const dot = document.createElement("span");
        dot.className = "desktop-dot";
        if (index === 0) dot.classList.add("active");
        desktopDotsContainer.appendChild(dot);
        desktopDots.push(dot);
    });

    // Mobile Carousel
    const mobileCarouselContainer = document.createElement("div");
    mobileCarouselContainer.className = "mobile-carousel-container";
    container.appendChild(mobileCarouselContainer);

    const mobileCarouselSlide = document.createElement("div");
    mobileCarouselSlide.className = "mobile-carousel-slide";
    mobileCarouselContainer.appendChild(mobileCarouselSlide);

    // Create mobile slides
    allProducts.forEach((itemData, index) => {
        const mobileSlide = document.createElement("div");
        mobileSlide.className = "mobile-product-slide";

        const product = createProductCard(itemData);
        mobileSlide.appendChild(product);
        mobileCarouselSlide.appendChild(mobileSlide);
    });

    // Mobile slider dots container 1
    const mobileSliderDots1 = document.createElement("div");
    mobileSliderDots1.className = "mobile-slider-dots-container1";
    container.appendChild(mobileSliderDots1);

    const mobileDots1 = [];
    allProducts.forEach((_, index) => {
        const dot = document.createElement("span");
        dot.className = "mobile-dot1";
        if (index === 0) dot.classList.add("active");
        mobileSliderDots1.appendChild(dot);
        mobileDots1.push(dot);
    });

    // Initialize carousel functionality
    initializeCarousel(carouselSlide, mobileCarouselSlide, desktopDots, mobileDots1, productSections, allProducts, prevButton, nextButton);
}

// Create product card function
function createProductCard(itemData) {
    const product = document.createElement("div");
    product.className = "product";

    if (itemData.bestseller === true) {
        const badge = document.createElement("span");
        badge.textContent = "Best Seller";
        badge.style.position = "absolute";
        badge.style.top = "0.55rem";
        badge.style.right = "0.20rem";
        badge.style.backgroundColor = "rgb(245, 111, 0)";
        badge.style.color = "white";
        badge.style.fontSize = "12px";
        badge.style.fontWeight = "bold";
        badge.style.padding = "0.25rem 0.75rem";
        badge.style.borderRadius = "9999px";
        badge.style.zIndex = "2";
        product.appendChild(badge);
    }

    const imgContainer = document.createElement("div");
    imgContainer.className = "product-img-container";

    const productImg = document.createElement("img");
    productImg.className = "product-img";
    productImg.alt = itemData.name || "Delicious Cake";
    productImg.loading = "lazy";

    // Use menuCatgImage or fallback to image
    const imageId = itemData.menuCatgImage || itemData.image;
    const imgSrc = imageId
        ? getImageUrl(imageId)
        : "https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80";

    productImg.src = imgSrc;

    // Handle image load errors
    productImg.onerror = function () {
        this.src = "https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80";
        console.warn(`Failed to load image for ${itemData.packageName}, using fallback`);
    };

    imgContainer.appendChild(productImg);
    product.appendChild(imgContainer);

    const productContent = document.createElement("div");
    productContent.className = "product-content";

    const productName = document.createElement("div");
    productName.className = "product-name";
    productName.textContent = itemData.packageName || "Special Cake";

    const productPrice = document.createElement("div");
    productPrice.className = "product-price";
    productPrice.textContent = `From SGD$ ${parseFloat(itemData.unitPrice || 0).toFixed(2)}`;

    const detailsBtn = document.createElement("button");
    detailsBtn.className = "details-btn";
    detailsBtn.textContent = "Details";
    detailsBtn.setAttribute("onclick", `sessionStorage.setItem('menuPackage','${itemData.id}');location.href='/SecretRecipe/Product/${itemData.id}';`);

    productContent.appendChild(productName);
    productContent.appendChild(productPrice);
    productContent.appendChild(detailsBtn);
    product.appendChild(productContent);

    return product;
}

// Initialize carousel functionality
function initializeCarousel(carouselSlide, mobileCarouselSlide, desktopDots, mobileDots1, productSections, allProducts, prevButton, nextButton) {
    let currentSlide = 0;
    let mobileCurrentIndex = 0;
    let slideInterval;

    // Desktop carousel functions
    function updateCarousel() {
        const offset = -currentSlide * 100;
        carouselSlide.style.transform = `translateX(${offset}%)`;
        desktopDots.forEach((dot, index) => {
            dot.classList.toggle("active", index === currentSlide);
        });
    }

    function goToSlide(index) {
        currentSlide = index;
        updateCarousel();
    }

    function nextSlide() {
        if (currentSlide < productSections.length - 1) {
            currentSlide++;
            updateCarousel();
        } else {
            updateCarousel();
            setTimeout(() => {
                currentSlide = 0;
                updateCarousel();
            }, 1500);
        }
    }

    function prevSlide() {
        currentSlide = (currentSlide - 1 + productSections.length) % productSections.length;
        updateCarousel();
    }

    // Mobile carousel functions
    function updateMobileCarousel() {
        const offset = -mobileCurrentIndex * 100;
        mobileCarouselSlide.style.transform = `translateX(${offset}%)`;
        mobileDots1.forEach((dot, index) => {
            dot.classList.toggle("active", index === mobileCurrentIndex);
        });
    }

    // Event listeners
    prevButton.onclick = prevSlide;
    nextButton.onclick = nextSlide;

    desktopDots.forEach((dot, index) => {
        dot.onclick = () => goToSlide(index);
    });

    mobileDots1.forEach((dot, index) => {
        dot.onclick = () => {
            mobileCurrentIndex = index;
            updateMobileCarousel();
        };
    });

    // Swipe handling for mobile
    let mobileStartX = 0;
    let mobileEndX = 0;

    const mobileCarouselContainer = mobileCarouselSlide.parentElement;
    mobileCarouselContainer.addEventListener("touchstart", (e) => {
        mobileStartX = e.touches[0].clientX;
    }, { passive: true });

    mobileCarouselContainer.addEventListener("touchend", (e) => {
        mobileEndX = e.changedTouches[0].clientX;
        const delta = mobileEndX - mobileStartX;
        if (Math.abs(delta) > 50) {
            if (delta < 0) {
                mobileCurrentIndex = (mobileCurrentIndex + 1) % allProducts.length;
            } else {
                mobileCurrentIndex = (mobileCurrentIndex - 1 + allProducts.length) % allProducts.length;
            }
            updateMobileCarousel();
        }
    }, { passive: true });

    // Touch support for desktop
    let touchStartX = 0;
    let touchEndX = 0;

    const carouselContainer = carouselSlide.parentElement;
    carouselContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    carouselContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const threshold = 50;
        if (touchStartX - touchEndX > threshold) {
            nextSlide();
        } else if (touchEndX - touchStartX > threshold) {
            prevSlide();
        }
    }, { passive: true });

    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            updateCarousel();
            updateMobileCarousel();
        }, 250);
    });

    // Initialize carousels
    updateCarousel();
    updateMobileCarousel();
}



function setMobileTwoItemsPerRow() {
    const items = document.querySelectorAll('.item'); // Target your item class
    const mobileBreakpoint = 768; // Adjust if needed (e.g., 600px)

    if (window.innerWidth < mobileBreakpoint) {
        items.forEach(item => {
            item.style.flex = '0 0 calc(50% - 8px)'; // 2 items per row (with gap)
            item.style.margin = '4px'; // Small gap (adjust as needed)
            item.style.boxSizing = 'border-box'; // Prevent overflow
        });
    } else {
        // Reset to original styles (if JS was applied earlier)
        items.forEach(item => {
            item.style.flex = '';
            item.style.margin = '';
        });
    }
}

// Run on load + resize
window.addEventListener('load', setMobileTwoItemsPerRow);
window.addEventListener('resize', setMobileTwoItemsPerRow);


function resetIcingSelection() {
    // Clear sessionStorage
    sessionStorage.removeItem("IcingImage");
    sessionStorage.removeItem("IcingCharges");

    // Reset file input
    const imgInput = document.getElementById("imgInput");
    if (imgInput) {
        imgInput.value = "";
    }


    // Hide icing banner
    const cakeBanner = document.getElementById("cake-charge-banner");
    if (cakeBanner) {
        cakeBanner.style.display = "none";
    }

    console.log("🔄 Icing selection reset due to option change.");
}

function GetProduct() {
    GetBestSeller();
    cartCount();

    // Try sessionStorage first
    let menuPackage = sessionStorage.getItem("menuPackage");

    // Fallback: Get from URL if sessionStorage is empty
    if (!menuPackage) {
        const urlParams = new URLSearchParams(window.location.search);
        menuPackage = urlParams.get("menuPackage");

        if (menuPackage) {
            sessionStorage.setItem("menuPackage", menuPackage);
        } else {
            console.error("menuPackage not found in session or URL.");
            return;
        }
    }

    sessionStorage.setItem("IcingImage", null);

    $.ajax({
        type: "GET",
        dataType: "json",
        url: `/SR/GetMenuPackageByMenu?menuPackage=${menuPackage}`,
        success: function (menuData) {
            const isIcing = Boolean(menuData?.response?.data?.[0]?.isAcceptIcingImage);
            //const IcingInfo = JSON.parse(sessionStorage.getItem("IcingImageInfo"));

            sessionStorage.setItem("isIcing", isIcing);

            if (isIcing) {
                const icingImgEl = document.getElementById("IcingImg");
                if (icingImgEl) icingImgEl.style.display = "block";
                //$.ajax({
                //    type: "GET",
                //    dataType: "json",
                //    url: `/SR/MenuList?menuPackage=${IcingInfo.menuPackage}`,
                //    success: function (data) {
                //        // Step 1: normalize response
                //        const parsedData = typeof data.data === "string" ? JSON.parse(data.data) : data.data;
                //        const responseData = Array.isArray(parsedData?.response?.data) ? parsedData.response.data : [];
                //        console.log("responseData", responseData);

                //        if (responseData.length > 0) {
                //            const item = responseData[0]; // first icing record

                //            const IcingUOM = {
                //                product: item.product,
                //                size: item["size$_identifier"],   // safer with bracket notation
                //                unitPrice: item.unitPrice,
                //                menuPackage: item.menuPackage,
                //                uom: item.uOM
                //            };
                //            sessionStorage.setItem("IcingUOM", JSON.stringify(IcingUOM));
                //        }
                //    }
                //});

            }

            try {
                // Call MenuList API
                $.ajax({
                    type: "GET",
                    dataType: "json",
                    url: `/SR/MenuList?menuPackage=${menuPackage}`,
                    success: function (data) {
                        // Step 1: normalize response
                        const parsedData = typeof data.data === "string" ? JSON.parse(data.data) : data.data;
                        const responseData = Array.isArray(parsedData?.response?.data) ? parsedData.response.data : [];

                        // Step 2: transform into cleaner objects
                        const items = responseData.map(item => ({
                            id: item.product,
                            listID: item.id,
                            code: item.searchKey || "",
                            name: item.name || "Unnamed",
                            size: (item["size$_identifier"] || "Unknown").toUpperCase(),
                            category: item["menuCategoryGroup$_identifier"] || "Unknown",
                            package: item["menuPackage$_identifier"] || "",
                            price: parseFloat(item.unitPrice || 0),
                            available: item.available ?? true,
                            image: item.image || "https://cdn.store-assets.com/s/896/i/74887768.jpeg"
                        }));

                        // Step 3: keep only first entry per size (unique by size)
                        const uniqueSizesMap = new Map();
                        items.forEach(item => {
                            if (!uniqueSizesMap.has(item.size)) {
                                uniqueSizesMap.set(item.size, item);
                            }
                        });

                        //// Step 4: sort sizes in custom order
                        //const customSizeOrder = ["REGULAR", "1R", "2R", "3R", "4R", "6R"];
                        //const sortedItems = Array.from(uniqueSizesMap.values()).sort((a, b) => {
                        //    const idxA = customSizeOrder.indexOf(a.size);
                        //    const idxB = customSizeOrder.indexOf(b.size);
                        //    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
                        //});
                        // Step 3: keep only first entry per size (unique by size)
                      

                        // Step 4: sort sizes naturally (numeric value first, "REGULAR" or non-numeric last)
                        const sortedItems = Array.from(uniqueSizesMap.values()).sort((a, b) => {
                            const parseSize = (size) => {
                                const match = size.match(/[\d.]+/);
                                return match ? parseFloat(match[0]) : Infinity;
                            };

                            const numA = parseSize(a.size);
                            const numB = parseSize(b.size);

                            if (numA !== numB) return numA - numB;

                            return a.size.localeCompare(b.size);
                        });

                        // Step 5: build dropdown with disabled styling but clickable
                        const fieldset = document.getElementById("productSelect-option-0");
                        if (!fieldset) return;

                        // Add CSS for disabled look
                        const style = document.createElement('style');
                        style.textContent = `
                #addOnType option.out-of-stock {
                    color: #999 !important;
                    background-color: #f5f5f5 !important;
                }
            `;
                        if (!document.getElementById('out-of-stock-style')) {
                            style.id = 'out-of-stock-style';
                            document.head.appendChild(style);
                        }

                        let html = '<select name="Size" id="addOnType" class="w-full border px-3 py-2 rounded">';
                        sortedItems.forEach(item => {
                            html += `<option value="${item.size}" 
                    id="${item.id}"
                    listId="${item.listID}"
                    data-price="${item.price.toFixed(2)}" 
                    data-available="${item.available ? 1 : 0}" 
                    data-variant-img="${item.image}"
                    class="${!item.available ? 'out-of-stock' : ''}">
                    ${item.size} ${!item.available ? "(Out of Stock)" : ""}
                </option>`;
                        });
                        html += "</select>";
                        fieldset.innerHTML = html;

                        // Step 6: set default selection
                        const addOnTypeSelect = document.getElementById("addOnType");
                        if (!addOnTypeSelect) return;

                        let defaultOption = Array.from(addOnTypeSelect.options).find(o => o.dataset.available == "1");
                        if (defaultOption) {
                            // ✅ Only set and call API if available
                            addOnTypeSelect.value = defaultOption.value;
                            sessionStorage.setItem("type", defaultOption.value);
                            sessionStorage.setItem("typeID", defaultOption.id);
                            sessionStorage.setItem("isAvailable", "1");

                            const price = parseFloat(defaultOption.dataset.price || 0).toFixed(2);
                            sessionStorage.setItem("menuPrice", price);
                            const qty = parseInt(sessionStorage.getItem("Qty") || "1");
                            sessionStorage.setItem("total", (price * qty).toFixed(2));

                            const promoPriceEl = document.getElementById("promoPrice");
                            if (promoPriceEl) promoPriceEl.innerText = "SGD$ " + price;

                            // Enable add to cart button
                            updateAddToCartButton(true);

                            // Call add-on API with default listID
                            const defaultListID = defaultOption.getAttribute("listid");

                            $.ajax({
                                type: "GET",
                                dataType: "json",
                                url: `/SR/MenuListAddOn?id=${defaultListID}`,
                                success: function (data) {
                                    try {
                                        const parsed = typeof data.data === "string" ? JSON.parse(data.data) : data.data;
                                        const responseData = Array.isArray(parsed?.response?.data) ? parsed.response.data : [];

                                        const addons = responseData.map(item => ({
                                            id: item.id,
                                            productId: item.product,
                                            name: item["product$_identifier"] || item._identifier || "Unnamed AddOn",
                                            uom: item.uOM,
                                            qty: item.quantity || 0,
                                            price: parseFloat(item.unitPrice || 0),
                                            amount: parseFloat(item.amount || 0),
                                        }));

                                        sessionStorage.setItem("menulistAddon", JSON.stringify(addons));
                                        console.log("✅ Default AddOn Data:", addons);
                                    } catch (err) {
                                        console.error("❌ Error parsing Default AddOn Data:", err, data);
                                    }
                                },
                                error: function (xhr, status, error) {
                                    console.error("MenuListAddOn AJAX Error:", status, error);
                                }
                            });

                        } else {
                            // ❌ No available option — disable add to cart
                            console.warn("No available sizes, disabling add to cart");
                            if (addOnTypeSelect.options.length > 0) {
                                const firstOption = addOnTypeSelect.options[0];
                                addOnTypeSelect.value = firstOption.value;
                                sessionStorage.setItem("type", firstOption.value);
                                sessionStorage.setItem("typeID", firstOption.id);
                                sessionStorage.setItem("isAvailable", "0");

                                const price = parseFloat(firstOption.dataset.price || 0).toFixed(2);
                                sessionStorage.setItem("menuPrice", price);
                                const qty = parseInt(sessionStorage.getItem("Qty") || "1");
                                sessionStorage.setItem("total", (price * qty).toFixed(2));

                                const promoPriceEl = document.getElementById("promoPrice");
                                if (promoPriceEl) promoPriceEl.innerText = "SGD$ " + price;
                            }
                            updateAddToCartButton(false);
                        }

                        // Step 7: change handler
                        addOnTypeSelect.addEventListener("change", (e) => {
                            const selOption = e.target.options[e.target.selectedIndex];
                            if (!selOption) return;

                            const isAvailable = selOption.dataset.available === "1";
                            const price = parseFloat(selOption.dataset.price || 0).toFixed(2);
                            const listID = selOption.getAttribute("listid");

                            sessionStorage.setItem("type", selOption.value);
                            sessionStorage.setItem("typeID", selOption.id);
                            sessionStorage.setItem("menuPrice", price);
                            sessionStorage.setItem("isAvailable", isAvailable ? "1" : "0");

                            const qty = parseInt(sessionStorage.getItem("Qty") || "1");
                            sessionStorage.setItem("total", (price * qty).toFixed(2));

                            const promoPriceEl = document.getElementById("promoPrice");
                            if (promoPriceEl) promoPriceEl.innerText = "SGD$ " + price;

                            // Update add to cart button based on availability
                            updateAddToCartButton(isAvailable);

                            // Only call add-on API if available
                            if (isAvailable) {
                                $.ajax({
                                    type: "GET",
                                    dataType: "json",
                                    url: `/SR/MenuListAddOn?id=${listID}`,
                                    success: function (data) {
                                        try {
                                            const parsed = typeof data.data === "string" ? JSON.parse(data.data) : data.data;
                                            const responseData = Array.isArray(parsed?.response?.data) ? parsed.response.data : [];

                                            const addons = responseData.map(item => ({
                                                id: item.id,
                                                productId: item.product,
                                                name: item["product$_identifier"] || item._identifier || "Unnamed AddOn",
                                                uom: item.uOM,
                                                qty: item.quantity || 0,
                                                price: parseFloat(item.unitPrice || 0),
                                                amount: parseFloat(item.amount || 0),
                                            }));

                                            sessionStorage.setItem("menulistAddon", JSON.stringify(addons));
                                            console.log("✅ Normalized AddOn Data:", addons);
                                        } catch (err) {
                                            console.error("❌ Error parsing AddOn Data:", err, data);
                                        }
                                    },
                                    error: function (xhr, status, error) {
                                        console.error("MenuListAddOn AJAX Error:", status, error);
                                    }
                                });
                            } else {
                                console.warn("Selected size is out of stock, skipping AddOn API call");
                                sessionStorage.setItem("menulistAddon", JSON.stringify([]));
                            }
                        });

                        console.log("Available sizes:", sortedItems.map(i => i.size));
                    },
                    error: function (xhr, status, error) {
                        console.error("MenuList AJAX Error:", status, error);
                    }
                });

                // Function to update Add to Cart button state
                function updateAddToCartButton(isEnabled) {
                    const addToCartBtn = document.getElementById("addToCartBtn") ||
                        document.querySelector('[onclick*="addToCart"]') ||
                        document.querySelector('button[type="submit"]');

                    if (addToCartBtn) {
                        if (isEnabled) {
                            addToCartBtn.disabled = false;
                            addToCartBtn.style.opacity = "1";
                            addToCartBtn.style.cursor = "pointer";
                            addToCartBtn.style.pointerEvents = "auto";
                            addToCartBtn.classList.remove("disabled", "btn-disabled");
                        } else {
                            addToCartBtn.disabled = true;
                            addToCartBtn.style.opacity = "0.5";
                            addToCartBtn.style.cursor = "not-allowed";
                            addToCartBtn.style.pointerEvents = "none";
                            addToCartBtn.classList.add("disabled");
                        }
                    }

                    // Disable/Enable cake design image section
                    const icingImgSection = document.getElementById("IcingImg");
                    const imgInput = document.getElementById("imgInput");
                    const deleteIcingBtn = document.getElementById("deleteIcing");

                    if (icingImgSection) {
                        if (isEnabled) {
                            icingImgSection.style.opacity = "1";
                            icingImgSection.style.pointerEvents = "auto";
                            if (imgInput) imgInput.disabled = false;
                            if (deleteIcingBtn) deleteIcingBtn.disabled = false;
                        } else {
                            icingImgSection.style.opacity = "0.5";
                            icingImgSection.style.pointerEvents = "none";
                            if (imgInput) imgInput.disabled = true;
                            if (deleteIcingBtn) deleteIcingBtn.disabled = true;
                        }
                    }
                }

                // Intercept form submission and cart actions
                document.addEventListener("submit", function (e) {
                    const isAvailable = sessionStorage.getItem("isAvailable");
                    if (isAvailable === "0") {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        alert("This item is currently out of stock and cannot be added to cart.");
                        return false;
                    }
                }, true);

                // Intercept click events on add to cart button
                document.addEventListener("click", function (e) {
                    const target = e.target;
                    if (target.id === "addToCartBtn" ||
                        target.getAttribute("onclick")?.includes("addToCart") ||
                        target.closest('[onclick*="addToCart"]')) {

                        const isAvailable = sessionStorage.getItem("isAvailable");
                        if (isAvailable === "0") {
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            alert("This item is currently out of stock and cannot be added to cart.");
                            return false;
                        }
                    }
                }, true);

                // Handle menu package data
                const parsedMenuData = menuData.data ? JSON.parse(menuData.data) : menuData;
                const items = parsedMenuData.response?.data ?? [];
                if (items.length === 0) return;

                const item = items[0];
                const {
                    menuCatgImage: menuImg = "placeholder_image_base64",
                    menuCatgImage2: menuImg2 = "placeholder_image_base64",
                    packageName: itemName,
                    description: description = "No Description",
                    showDetails: details = "No Description",
                    unitPrice: itemPrice = 0,
                    selfCollectionAllowed: selfCollection = false,
                    hasCollection = false,
                    uOM: itemUOM = '',
                    product: product = '',
                    menuCategoryGroup$_identifier: categoryName = "No Category"
                } = item;

                const imgSrc = "data:image/png;base64," + menuImg;

                // Update DOM and sessionStorage
                sessionStorage.setItem("itemArray", JSON.stringify({ menuImg, itemName, itemPrice }));
                sessionStorage.setItem("menuName", itemName);
                sessionStorage.setItem("selfCollectionAllowed", selfCollection);
                sessionStorage.setItem("itemUOM", itemUOM);
                sessionStorage.setItem("hasCollection", hasCollection);
                sessionStorage.setItem("menuPrice", itemPrice.toFixed(2));
                sessionStorage.setItem("total", (itemPrice * parseInt(sessionStorage.getItem("Qty") || "1")).toFixed(2));
                sessionStorage.setItem("productId", product);

                document.getElementById("detailsSectionText").innerHTML = (details ?? "No Description").replace(/\n/g, "<br>");
                document.getElementById("descriptionSectionText").innerText = description;

                const setImageSrc = (id, src) => { const el = document.getElementById(id); if (el) el.src = src; };
                setImageSrc("promoImage", imgSrc);
                setImageSrc("zmimage", imgSrc);
                setImageSrc("zmimage2", "data:image/png;base64," + menuImg2);
                setImageSrc("pImg1", imgSrc);
                setImageSrc("pImg2", "data:image/png;base64," + menuImg2);

                const setText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
                setText("promolbl", itemName);
                setText("pTitle", itemName);

                document.querySelectorAll('.preview-image').forEach(preview => {
                    preview.addEventListener('click', function () {
                        const mainImage = document.getElementById('zmimage');
                        if (mainImage && this.src) {
                            mainImage.src = this.src;
                            document.querySelectorAll('.preview-image').forEach(img => img.classList.remove('active-preview'));
                            this.classList.add('active-preview');
                        }
                    });
                });

            } catch (error) {
                console.error("Error processing menu data:", error);
            }
        },
        error: function (xhr, status, error) {
            console.error("GetMenuPackageByMenu AJAX Error:", { xhr, status, error });
        }
    });
}



//function GetProduct() {
//    GetBestSeller();
//    cartCount();
//    // Try sessionStorage first
//    let menuPackage = sessionStorage.getItem("menuPackage");

//    // Fallback: Get from URL if sessionStorage is empty (e.g. right-click new tab)
//    if (!menuPackage) {
//        const urlParams = new URLSearchParams(window.location.search);
//        menuPackage = urlParams.get("menuPackage");

//        // Save to sessionStorage for consistency
//        if (menuPackage) {
//            sessionStorage.setItem("menuPackage", menuPackage);
//        } else {
//            console.error("menuPackage not found in session or URL.");
//            return;
//        }
//    }

//    sessionStorage.setItem("IcingImage", null);
//    $.ajax({
//        type: "GET",
//        dataType: "json",
//        url: `/SR/GetMenuPackageByMenu?menuPackage=${menuPackage}`,
//        success: function (menuData) {
//            // Safely extract the icing flag from the correct structure
//            const isIcing = Boolean(menuData?.response?.data?.[0]?.isAcceptIcingImage);
//            console.log("isIcing", isIcing);
//            // Store as a string
//            sessionStorage.setItem("isIcing", isIcing);

//            // Show the image if true
//            if (isIcing) {
//                document.getElementById("IcingImg").style.display = "block";
//            }
//            try {
//                // Call MenuList API
//                $.ajax({
//                    type: "GET",
//                    dataType: "json",
//                    url: `/SR/MenuList?menuPackage=${menuPackage}`,
//                    success: function (data) {

//                        // Parse response safely
//                        const parsedData = typeof data.data === "string" ? JSON.parse(data.data) : data.data;
//                        const responseData = Array.isArray(parsedData?.response?.data)
//                            ? parsedData.response.data
//                            : [];

//                        const fieldset = document.getElementById("productSelect-option-0");
//                        //const addOnTypeEl = document.getElementById("addOnType");
//                        if (!fieldset) {
//                            console.warn("Required DOM elements not found.");
//                            return;
//                        }

//                        let html = '<select name="Size" id="addOnType" class="w-full border px-3 py-2 rounded">';
//                        let optionsHtml = "";
//                        let tagIndex = 0;
//                        let sizeSet = new Set();

//                        responseData.forEach((itemData) => {
//                            if (!itemData) return;

//                            const sizeIdentifier = itemData["size$_identifier"] || "Unknown";
//                            const size = itemData.size;

//                            // Avoid duplicate size entries
//                            if (!size || sizeSet.has(sizeIdentifier)) return;
//                            sizeSet.add(sizeIdentifier);

//                            // Create <option> for dropdown
//                        //    optionsHtml += `
//                        //            <option value="${sizeIdentifier}"
//                        //            id="${size}"
//                        //            data-price="${itemData.price || 0}"
//                        //            data-compare_at_price="${itemData.compareAtPrice || 0}"
//                        //            data-quantity="${itemData.quantity || ''}"
//                        //            data-available="${itemData.available ?? 1}"
//                        //            data-promotion-id="${itemData.promotionId || 0}"
//                        //            data-product-id="${size}"
//                        //            data-variant-img="${itemData.image || 'https://cdn.store-assets.com/s/896/i/74887768.jpeg'}">
//                        //                ${sizeIdentifier}
//                        //            </option>`;

//                            html += `<option value="${sizeIdentifier}" 
//                                    id="${size}" 
//                                    data-price="${itemData.unitPrice.toFixed(2) || 0}" 
//                                    data-compare_at_price="${itemData.compareAtPrice || 0}" 
//                                    data-quantity="${itemData.quantity || ''}" 
//                                    data-available="${itemData.available ?? 1}" 
//                                    data-promotion-id="${itemData.promotionId || 0}" 
//                                    data-product-id="${size}" 
//                                    data-variant-img="${itemData.image || 'https://cdn.store-assets.com/s/896/i/74887768.jpeg'}">
//                                    ${sizeIdentifier}
//                                </option>`;
//                            tagIndex++;

//                        });



//                        // Insert HTML into DOM
//                        fieldset.innerHTML = html;
//                        //addOnTypeEl.innerHTML = optionsHtml;

//                        // ✅ Safe: DOM now has the #addOnType select
//                        const addOnTypeSelect = document.getElementById("addOnType");
//                        const selectedOption = addOnTypeSelect.options[addOnTypeSelect.selectedIndex];
//                        const price = parseFloat(selectedOption.dataset.price).toFixed(2);
//                        document.getElementById("promoPrice").innerText = "SGD$ " + price;    

//                        if (selectedOption) {
//                            sessionStorage.setItem("type", selectedOption.value || "");
//                            sessionStorage.setItem("typeID", selectedOption.id || "");
//                        }
//                        //console.log("Selected type:", selectedOption.value);

//                        const savedType = sessionStorage.getItem("type") || "";
//                        const firstOption = addOnTypeSelect.options[0];

//                        // Try to find the matching option by value
//                        const matchedOption = Array.from(addOnTypeSelect.options).find(
//                            (option) => option.value === savedType
//                        );

//                        if (!savedType && firstOption) {
//                            // No type saved, default to the first option
//                            addOnTypeSelect.value = firstOption.value;
//                            sessionStorage.setItem("type", firstOption.value);
//                            sessionStorage.setItem("typeID", firstOption.id);
//                        } else if (matchedOption) {
//                            // Type found in session, set as selected
//                            addOnTypeSelect.value = matchedOption.value;
//                            sessionStorage.setItem("type", matchedOption.value);
//                            sessionStorage.setItem("typeID", matchedOption.id);
//                        } else if (firstOption) {
//                            // Fallback to first option if no match
//                            addOnTypeSelect.value = firstOption.value;
//                            sessionStorage.setItem("type", firstOption.value);
//                            sessionStorage.setItem("typeID", firstOption.id);
//                        }

//                        // Fix the change event handler for the select dropdown
//                        addOnTypeSelect.addEventListener("change", (e) => {
//                            const selectedOption = e.target.options[e.target.selectedIndex];

//                            // ✅ Fix: Use dataset.price or getAttribute("data-price") instead of getAttribute("price")
//                            const price = parseFloat(selectedOption.dataset.price).toFixed(2);

//                            sessionStorage.setItem("type", selectedOption.value);
//                            sessionStorage.setItem("typeID", selectedOption.id);

//                            // Update price display
//                            document.getElementById("promoPrice").textContent = "SGD$ " + price;

//                            // Store price and calculate total
//                            sessionStorage.setItem("menuPrice", price);
//                            const quantity = parseInt(sessionStorage.getItem("Qty") || "1");
//                            sessionStorage.setItem("total", (price * quantity).toFixed(2));

//                            console.log("Selected type changed to:", selectedOption.value, price);
//                        });
//                        // Bind tab click events
//                        document.querySelectorAll('.tab-item').forEach(tab => {
//                            tab.addEventListener('click', function () {
//                                document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('text-black', 'font-bold'));
//                                this.classList.add('text-black', 'font-bold');
//                                moveUnderline(this);
//                            });
//                        });

//                        // Activate default tab (e.g., CHEESE CAKES)
//                        const defaultTab = Array.from(document.querySelectorAll('.tab-item'))
//                            .find(tab => tab.textContent.trim().toUpperCase() === "CHEESE CAKES")
//                            || document.querySelector('.tab-item');

//                        if (defaultTab) {
//                            defaultTab.classList.add('text-black', 'font-bold');
//                            moveUnderline(defaultTab);
//                        }

//                        console.log("Type set to:", sessionStorage.getItem("type"));
//                    },
//                    error: function (xhr, status, error) {
//                        console.error("MenuList AJAX Error:", status, error);
//                    }
//                });

//                const parsedMenuData = menuData.data ? JSON.parse(menuData.data) : menuData;
//                const items = parsedMenuData.response?.data ?? [];

//                if (items.length === 0) return;

//                const item = items[0]; // Assuming only the first item is needed

//                const {
//                    menuCatgImage: menuImg = "placeholder_image_base64",
//                    menuCatgImage2: menuImg2 = "placeholder_image_base64",
//                    menuPackage$_identifier: itemName = "No Description",
//                    description: description = "No Description",
//                    showDetails: details = "No Description",
//                    unitPrice: itemPrice = 0,
//                    selfCollectionAllowed: selfCollection = false,
//                    hasCollection = false,
//                    uOM: itemUOM = '',
//                    product: productId = ''
//                } = item;

//                const imgSrc = "data:image/png;base64," + menuImg;

//                // Update DOM elements
//                sessionStorage.setItem("itemArray", JSON.stringify({ menuImg, itemName, itemPrice }));
//                sessionStorage.setItem("menuName", itemName);
//                sessionStorage.setItem("selfCollectionAllowed", selfCollection);
//                sessionStorage.setItem("itemUOM", itemUOM);
//                sessionStorage.setItem("hasCollection", hasCollection);
//                sessionStorage.setItem("menuPrice", itemPrice.toFixed(2));
//                sessionStorage.setItem("total", (itemPrice * parseInt(sessionStorage.getItem("Qty") || "1")).toFixed(2));
//                sessionStorage.setItem("productId", productId);
//                const formattedDetails = (details ?? "No Description").replace(/\n/g, "<br>");
//                document.getElementById("detailsSectionText").innerHTML = formattedDetails || "";
//                document.getElementById("descriptionSectionText").innerHTML = description || "";
//                // Apply image and text updates
//                const setImageSrc = (id, src) => {
//                    const el = document.getElementById(id);
//                    if (el) el.src = src;
//                };

//                setImageSrc("promoImage", imgSrc);
//                setImageSrc("zmimage", imgSrc);
//                setImageSrc("zmimage2", "data:image/png;base64," + menuImg2);
//                setImageSrc("pImg1", imgSrc);
//                setImageSrc("pImg2", "data:image/png;base64," + menuImg2);

//                const zmImage = document.getElementById("zmimage");
//                //if (zmImage) zmImage.style.borderRadius = "5%";

//                const setText = (id, text) => {
//                    const el = document.getElementById(id);
//                    if (el) el.innerText = text;
//                };
//                setText("promolbl", itemName);
//                setText("pTitle", itemName);
//                //setText("promoPrice", 'SGD$ ' + itemPrice.toFixed(2));
//                //setText("promoPrice1", 'SGD$ ' + itemPrice.toFixed(2));
//                const promoPriceEl = document.getElementById("promoPrice");
//                document.querySelectorAll('.preview-image').forEach(preview => {
//                    preview.addEventListener('click', function () {
//                        const mainImage = document.getElementById('zmimage'); // or 'promoImage'
//                        if (mainImage && this.src) {
//                            mainImage.src = this.src;
//                            // Optional styling to show active image
//                            document.querySelectorAll('.preview-image').forEach(img => img.classList.remove('active-preview'));
//                            this.classList.add('active-preview');
//                        }
//                    });
//                });

//            } catch (error) {
//                console.error("Error processing menu data:", error);
//            }
//        },
//        error: function (xhr, status, error) {
//            console.error("GetMenuPackageByMenu AJAX Error:", { xhr, status, error });
//        }
//    });
//}


document.addEventListener('DOMContentLoaded', function () {
    const fieldset = document.getElementById("productSelect-option-0");
    if (!fieldset) return;

    const radioButtons = fieldset.querySelectorAll('input[name="Size"]');
    if (radioButtons.length === 0) return;

    // Single function to handle storage and logging
    function handleRadioSelection(radio) {
        sessionStorage.setItem("type", radio.value);
        console.log(`${radio.value} is selected`);
    }

    // Restore from sessionStorage
    const storedValue = sessionStorage.getItem("type");
    let selectionMade = false;

    radioButtons.forEach(radio => {
        if (storedValue && radio.value === storedValue) {
            radio.checked = true;
            selectionMade = true;
            console.log(`${storedValue} restored from sessionStorage`);
        }
    });

    // Set default if nothing was stored
    if (!selectionMade && radioButtons.length > 0) {
        radioButtons[0].checked = true;
        handleRadioSelection(radioButtons[0]);
    }

    // Add event listeners
    radioButtons.forEach(radio => {
        radio.addEventListener('change', function () {
            if (this.checked) {
                handleRadioSelection(this);
            }
        });
    });
});

// Store data in session storage
//function storeSessionData(productCategory, productCategoryIdentifier,) {
//    sessionStorage.setItem('productCtg', productCategory);
//    sessionStorage.setItem('menuPackageSet', productCategoryIdentifier);
//}

function Menupakage() {
    cartCount();
    //sessionStorage.setItem('menuPackageSet', productCategoryIdentifier);
    const urlSegments = window.location.pathname.split('/');
    const productCategory = urlSegments[urlSegments.length - 1];

    const menuContainer = document.getElementById("menupackdiv");
    sessionStorage.setItem('productCtg', productCategory);
    const mainproductgrid = document.getElementById("main-collection-product-grid");
    const menuPackageid = '';
    // Clear previous content
    //menuContainer.innerHTML = '';


    //if (!productCategory) {
    //    console.error("Product category is missing.");
    //    return;
    //}

    $.ajax({
        type: "GET",
        dataType: "json",
        url: `/SR/GetMenuPackageSession?packageId=${productCategory}`,
        success: function (data) {
            try {
                const responseData = Array.isArray(data.response.data)
                    ? data.response.data
                    : JSON.parse(data.response.data);


                console.log(data.response.data)
                if (!responseData || responseData.length === 0) {
                    menuContainer.innerHTML = '<div class="error-message">No menu items found.</div>';
                    return;
                }

                //// Construct the carousel structure
                //let carouselHTML = `
                //    <button class="carousel-btn prev-btn">‹</button>
                //    <div class="carousel-items">
                //`;

                responseData.forEach((itemData) => {
                    if (!itemData) return; // Skip invalid items

                    const {
                        menuCatgImage: menuImg,
                        packageName: itemName = "No Description",
                        amount: itemPrice,
                        menuPackage: menuPackageid,
                        productCategory$_identifier: productCatg

                    } = itemData;
                    document.getElementById("carouseltitle").innerHTML = productCatg;
                    // Generate the product card
                    //carouselHTML += `
                    //    <div class="product-card">
                    //        <div class="card card--product card--outline grid-link__image--product" tabindex="-1">
                    //            <div class="card-wrapper">
                    //                <a onclick="sessionStorage.setItem('menuPackage','${menuPackageid}')" href="/SecretRecipe/Product/${menuPackageid}" class="full-unstyled-link">
                    //                    <div class="card card--product card--outline grid-link__image--product" tabindex="-1">
                    //                        <div class="card__inner">
                    //                            <div class="media media--transparent media--square media--hover-effect">
                    //                                <img src="data:image/png;base64,${menuImg}" alt="" loading="lazy">

                    //                                <img src="data:image/png;base64,${menuImg}" alt="" loading="lazy">

                    //                            </div>

                    //                        </div>
                    //                        <span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-ribbon prodlabelv2-top_right" style="background-color:rgb(237, 27, 37);color:rgb(255, 255, 255);font-size:15px;color:rgb(237, 27, 37);"><span class="prodlabelv2-badge-text" style="background-color:rgb(237, 27, 37);color:rgb(255, 255, 255);font-size:15px;">NEW</span></span>
                    //                    </div>

                    //                    <div class="card-information">
                    //                        <div class="card-information__wrapper">

                    //                            <span class="card-information__text h5" style="font-family:inherit; text-align: -webkit-left;">
                    //                                ${itemName}
                    //                            </span>

                    //                            <span class="caption-large light"></span>


                    //                            <div class="price">

                    //                                <dl>
                    //                                    <div class="price__regular">
                    //                                        <dt>
                    //                                            <span class="visually-hidden visually-hidden--inline">Regular price</span>
                    //                                        </dt>
                    //                                        <dd>
                    //                                            <span class="price-item price-item--regular">


                    //                                                <span class="money" data-ori-price="">SGD$${itemPrice.toFixed(2)} </span>


                    //                                            </span>
                    //                                        </dd>
                    //                                    </div>
                    //                                    <div class="price__sale">
                    //                                        <dt class="price__compare">
                    //                                            <span class="visually-hidden visually-hidden--inline">Regular price</span>
                    //                                        </dt>
                    //                                        <dd class="price__compare">
                    //                                            <s class="price-item price-item--regular">

                    //                                                <span class="money" data-ori-price="62.90">SGD$ 62.90 </span>


                    //                                            </s>
                    //                                        </dd>
                    //                                        <dt>
                    //                                            <span class="visually-hidden visually-hidden--inline">Sale price</span>
                    //                                        </dt>
                    //                                        <dd>
                    //                                            <span class="price-item price-item--sale">


                    //                                                <span class="money" data-ori-price="62.90">SGD$ 62.90 </span>


                    //                                            </span>
                    //                                        </dd>
                    //                                    </div>
                    //                                </dl>

                    //                            </div>

                    //                        </div>

                    //                    </div>
                    //                </a>
                    //            </div>
                    //            <span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-ribbon prodlabelv2-top_right" style="background-color:rgb(237, 27, 37);color:rgb(255, 255, 255);font-size:15px;color:rgb(237, 27, 37);"><span class="prodlabelv2-badge-text" style="background-color:rgb(237, 27, 37);color:rgb(255, 255, 255);font-size:15px;">NEW</span></span>
                    //        </div>
                    //    </div>`;

                    mainproductgrid.innerHTML += `
                        <li class="grid__item">
                            <div class="card-wrapper">
                                <div class="product-card1">
                                        <a href="/SecretRecipe/Product/${menuPackageId}?menuPackage=${menuPackageId}" onclick="sessionStorage.setItem('menuPackage','${menuPackageId}')" class="full-unstyled-link product-link1">                                    
                                        <div class="card card--product card--outline grid-link__image--product" tabindex="-1">
                                        <div class="card__inner">
                                            <div class="media media--transparent media--square media--hover-effect">
                                                  <img class="default-img" src="data:image/png;base64,${menuImg}" alt="${itemName}" loading="lazy">
                                                   <img class="hover-img" src="data:image/png;base64,${menuImg2}" alt="${itemName}" loading="lazy">
                                            </div>
                                                <span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-ribbon prodlabelv2-top_right" style="background-color:rgb(237, 27, 37);color:rgb(237, 27, 37);font-size:15px;">
                                                <span class="prodlabelv2-badge-text" style="background-color:rgb(237, 27, 37);color:rgb(255, 255, 255);font-size:15px;">NEW</span>
                                            </span>
                                        </div>
                                        <div class="card-information">
                                            <div class="card-information__wrapper">
                                                <span class="card-information__text h5" style="font-family:inherit; text-align: -webkit-left;">${itemName}</span>
                                                <span class="caption-large light"></span>
                                                <div class="price">
                                                    <dl>
                                                        <div class="price__regular">
                                                            <dt>
                                                                <span class="visually-hidden visually-hidden--inline">Regular price</span>
                                                            </dt>
                                                            <dd>
                                                                <span class="price-item price-item--regular">
                                                                    <span class="money" data-ori-price="62.90">SGD$ ${itemPrice.toFixed(2)}</span>
                                                                </span>
                                                            </dd>
                                                        </div>
                                                        <div class="price__sale">
                                                            <dt class="price__compare">
                                                                <span class="visually-hidden visually-hidden--inline">Regular price</span>
                                                            </dt>
                                                            <dd class="price__compare">
                                                                <s class="price-item price-item--regular">
                                                                    <span class="money" data-ori-price="62.90">SGD$ ${itemPrice.toFixed(2)}</span>
                                                                </s>
                                                            </dd>
                                                            <dt>
                                                                <span class="visually-hidden visually-hidden--inline">Sale price</span>
                                                            </dt>
                                                            <dd>
                                                                <span class="price-item price-item--sale">
                                                                    <span class="money" data-ori-price="62.90">SGD$ ${itemPrice.toFixed(2)}</span>
                                                                </span>
                                                            </dd>
                                                        </div>
                                                    </dl>
                                                </div>
                                            </div>
                                        </div>
                                    </a>
                                </div>
                            </li>
                    `;
                });

                // Close the carousel structure and add the next button
                carouselHTML += `
                    </div>
                    <button class="carousel-btn next-btn">›</button>
                `;

                // Add the carousel HTML to the container
                //menuContainer.innerHTML = carouselHTML;

            } catch (error) {
                console.error("Error processing menu data:", error);
                menuContainer.innerHTML = '<div class="error-message">Error processing menu data.</div>';
            }

        },
        error: function (xhr, status, error) {
            console.error("AJAX Error:", { xhr, status, error });
            menuContainer.innerHTML = '<div class="error-message">Error loading menu data.</div>';
        }
    });
}

// Function to load menu items and populate tabs
//function loadMenuItems() {
//    // First, fetch all categories or product types
//    $.ajax({
//        type: "GET",
//        dataType: "json",
//        url: "/SR/GetAllMenuPackageSession", // You'll need to create this endpoint
//        success: function (categories) {
//            // Create tabs for each category
//            const tabsContainer = document.getElementById('menuTabs');
//            const firstTabId = categories[0]?.id || '';

//            categories.forEach((category, index) => {
//                const tab = document.createElement('button');
//                tab.className = 'px-4 py-3 text-gray-600 hover:text-gray-900 transition-colors';
//                tab.textContent = category.name;
//                tab.dataset.categoryId = category.id;

//                if (index === 0) {
//                    tab.classList.add('text-gray-900');
//                    tab.classList.add('active-tab');
//                    // Set initial underline position
//                    document.getElementById('activeUnderline').style.width = `${tab.offsetWidth}px`;
//                    document.getElementById('activeUnderline').style.left = `${tab.offsetLeft}px`;
//                }

//                tab.addEventListener('click', function () {
//                    // Update active tab styling
//                    document.querySelectorAll('#menuTabs button').forEach(t => {
//                        t.classList.remove('text-gray-900', 'active-tab');
//                        t.classList.add('text-gray-600');
//                    });
//                    this.classList.add('text-gray-900', 'active-tab');

//                    // Move underline
//                    const underline = document.getElementById('activeUnderline');
//                    underline.style.width = `${this.offsetWidth}px`;
//                    underline.style.left = `${this.offsetLeft}px`;

//                    // Load products for this category
//                //    loadProductsForCategory(category.id);
//                });

//                tabsContainer.appendChild(tab);
//            });

//            //// Load products for the first category by default
//            //if (firstTabId) {
//            //    loadProductsForCategory(firstTabId);
//            //}
//        }
//    });
//}



//// Initialize the menu when the page loads
//document.addEventListener('DOMContentLoaded', function () {
//    loadMenuItems();
//});

function GetAllMenupakage() {
    cartCount();
    const mainproductgrid = document.getElementById("main-collection-product-grid");
    mainproductgrid.innerHTML = ''; // Clear previous content

    $.ajax({
        type: "GET",
        dataType: "json",
        url: `/SR/GetAllMenuPackageSession`,
        success: function (data) {
            console.log("Raw API response:", data);
            let responseData;
            try {
                // Parse first level if needed
                responseData = typeof data.data === "string" ? JSON.parse(data.data) : data.data;

                // Extract `response.data` if it exists
                if (responseData.response && responseData.response.data) {
                    responseData = responseData.response.data;
                }

                // Ensure it's an array
                if (!Array.isArray(responseData)) {
                    throw new Error("Expected an array but got: " + JSON.stringify(responseData));
                }
            } catch (error) {
                console.error("Error processing response:", error);
                mainproductgrid.innerHTML = '<div class="error-message">Error processing menu data.</div>';
                return;
            }

            console.log("Final processed data:", responseData);

            // Clear previous content
            mainproductgrid.innerHTML = '';

            // Loop through menu items
            responseData.forEach((itemData) => {
                if (!itemData) return;

                const {
                    menuCatgImage: menuImg = "",
                    packageName: itemName = "No Description",
                    amount: itemPrice = 0,
                    menuPackage: menuPackageid = "",
                    newItem = false,
                    bestseller = false,
                    available = false
                } = itemData;

                if (!available) return; // ❌ Skip unavailable items


                // Determine which badge to show
                let badgeHTML = "";
                if (isNew) {
                    badgeHTML = `
                        <span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-ribbon prodlabelv2-top_right" style="background-color:rgb(237, 27, 37);color:rgb(237, 27, 37);font-size:15px;">
                            <span class="prodlabelv2-badge-text" style="background-color:rgb(237, 27, 37);color:rgb(255, 255, 255);font-size:15px;">NEW</span>
                        </span>
                    `;
                } else if (isBestSeller) {
                    badgeHTML = `
                        <span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-ribbon prodlabelv2-top_right" style="background-color:gold;color:black;font-size:15px;">
                            <span class="prodlabelv2-badge-text" style="background-color:gold;color:black;font-size:15px;">BEST SELLER</span>
                        </span>
                    `;
                }

                mainproductgrid.innerHTML += `
                  <li class="grid__item">
                    <link rel="stylesheet" href="https://store-themes.easystore.co/896/themes/49034/assets/component-loading-overlay.css?t=1735784184" as="style" onload="this.onload=null;this.rel='stylesheet'">

                    <div class="card-wrapper">
                      <a href="/SecretRecipe/Product/${menuPackageid}" onclick="sessionStorage.setItem('menuPackage','${menuPackageid}')" class="full-unstyled-link">
                        <div class="card card--product card--outline grid-link__image--product" tabindex="-1">
                          <div class="card__inner">
                            <div class="media media--transparent media--square media--hover-effect">
                              <img src="data:image/png;base64,${menuImg}" alt="${itemName}" loading="lazy">
                            </div>
                            ${badgeHTML} <!-- Display badge here -->
                          </div>
                        </div>

                        <div class="card-information">
                          <div class="card-information__wrapper">
                            <span class="card-information__text h5" style="font-family:inherit; text-align: -webkit-left;">${itemName}</span>
                    
                            <div class="price">
                              <dl>
                                <div class="price__regular">
                                  <dt>
                                    <span class="visually-hidden visually-hidden--inline">Regular price</span>
                                  </dt>
                                  <dd>
                                    <span class="price-item price-item--regular">
                                      <span class="money" data-ori-price="${itemPrice.toFixed(2)}">SGD$ ${itemPrice.toFixed(2)}</span>
                                    </span>
                                  </dd>
                                </div>
                                <div class="price__sale">
                                  <dt class="price__compare">
                                    <span class="visually-hidden visually-hidden--inline">Regular price</span>
                                  </dt>
                                  <dd class="price__compare">
                                    <s class="price-item price-item--regular">
                                      <span class="money" data-ori-price="${itemPrice.toFixed(2)}">SGD$ ${itemPrice.toFixed(2)}</span>
                                    </s>
                                  </dd>
                                  <dt>
                                    <span class="visually-hidden visually-hidden--inline">Sale price</span>
                                  </dt>
                                  <dd>
                                    <span class="price-item price-item--sale">
                                      <span class="money" data-ori-price="${itemPrice.toFixed(2)}">SGD$ ${itemPrice.toFixed(2)}</span>
                                    </span>
                                  </dd>
                                </div>
                              </dl>
                            </div>
                          </div>
                        </div>
                      </a>
                    </div>
                  </li>
                `;
            });
        }
        ,
        error: function (xhr, status, error) {
            console.error("AJAX Error:", { xhr, status, error });
            mainproductgrid.innerHTML = '<div class="error-message">Error loading menu data.</div>';
        }
    });
}


function selectAddOnType() {
    const addOnType = document.getElementById("addOnType").value;
    sessionStorage.setItem("AddOnType", addOnType);
}




function addToCart1(event, menuPackage, productId, UOM, unitPrice, qty, menuName, img64) {
    // Prevent page refresh if it's a form submission or button click event
    if (event) {
        event.preventDefault();
    }
    window.scrollTo(0, 0);

    let quantity = parseInt(qty);
    let total = parseFloat(quantity * unitPrice).toFixed(2);
    //console.log(menuPackage, type, quantity, total, menuName, img64);

    let count = parseInt(sessionStorage.getItem("cartCount")) || 0;

    if (menuPackage !== '') {
        count++;
        // Remove 'hidden' class from cart count bubble
        let cartCountBubbles = document.getElementsByClassName("cart-count-bubble");
        for (let i = 0; i < cartCountBubbles.length; i++) {
            cartCountBubbles[i].classList.remove('hidden');
        }
        // Update the cart count in the UI
        let cartCountElement = document.getElementsByClassName("js-content-cart-count")[0];
        if (cartCountElement) {
            cartCountElement.innerText = count;  // Update the text to show the new cart count
        }
        sessionStorage.setItem("cartCount", count);
    }

    // Create the cart item
    const cartItem = {
        menuPackage: menuPackage,
        packageName: menuName,
        itemPrice: unitPrice,
        quantity: quantity,
        total: total,
        imgSrc: getImageUrl(img64),
        itemUOM: UOM,
        productId: productId
    };

    // Update cart in localStorage
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    cart.push(cartItem);  // Push the new cart item
    localStorage.setItem("cart", JSON.stringify(cart));

    console.log("cartItem", cartItem);
    cartCount();
    showCartNotification(cartItem);

    var element = document.getElementsByClassName("sf_promo-container")[0];
    if (element) {
        window.scrollBy(0, -2 * window.innerHeight / 3);
        element.style.display = "none";
    } else {
        console.log("Element not found.");
    }

    // Show the cart notification
}


function addToCart(event, menuPackage, productID, type, typeID, qty, menuName, unitPrice, img64, UOM, menuCtg, menuCtgItem) {
    if (event) event.preventDefault();
    window.scrollTo(0, 0);

    let quantity = parseInt(qty) || 1;

    // ✅ Get icing charge safely as number
    const icingCharge = parseFloat(sessionStorage.getItem("IcingCharges")) || 0;

    // Total = unitPrice * quantity + icingCharge
    let total = (unitPrice * quantity + icingCharge).toFixed(2);
    let cartItem = {};
    console.log(menuPackage, type, quantity, total, menuName, img64);

    // Update cart count
    let count = parseInt(sessionStorage.getItem("cartCount")) || 0;
    if (menuPackage && type && quantity) {
        count++;
        let cartCountBubbles = document.getElementsByClassName("cart-count-bubble");
        for (let i = 0; i < cartCountBubbles.length; i++) {
            cartCountBubbles[i].classList.remove('hidden');
        }
        let cartCountElement = document.getElementsByClassName("js-content-cart-count")[0];
        if (cartCountElement) cartCountElement.innerText = count;
        sessionStorage.setItem("cartCount", count);
    }

    // Cake writing
    let cakeWriting = document.getElementById("cake-writing")?.value || "";
    if (icingCharge) {
        // ✅ Load stored IcingUOM array/object from session
        const icingData = JSON.parse(sessionStorage.getItem("menulistAddon") || "[]");

        // Handle both single object and array
        const icingList = Array.isArray(icingData) ? icingData : [icingData];

        // ✅ Find the icing record that matches icingCharge
        const matchedIcing = icingList.find(item => parseFloat(item.price) === parseFloat(icingCharge));

        cartItem = {
            menuPackage,
            packageName: menuName,
            packageType: type,
            sizeID: typeID,
            itemPrice: parseFloat(unitPrice).toFixed(2),
            quantity,
            total,
            imgSrc: img64,
            itemUOM: UOM,
            menuCtg: menuCtg,
            menuCtgItem: menuCtgItem,
            productId: productID,
            cakeWriting,

            // Icing-specific
            IcingImage: sessionStorage.getItem("IcingImage"),
            IcingCharges: icingCharge,
            IcingProduct: matchedIcing ? matchedIcing.productId : null,
            IcingSize: matchedIcing ? matchedIcing.id : null,
            IcingUOM: matchedIcing ? matchedIcing.uom : null

        };
    } else {
        // Build cart item object
        cartItem = {
            menuPackage,
            packageName: menuName,
            packageType: type,
            sizeID: typeID,
            itemPrice: parseFloat(unitPrice).toFixed(2),
            quantity,
            total,
            imgSrc: img64,
            itemUOM: UOM,
            menuCtg: menuCtg,
            menuCtgItem: menuCtgItem,
            productId: productID,
            IcingImage: sessionStorage.getItem("IcingImage"),
            IcingCharges: icingCharge,
            cakeWriting
        };
    }


    // Save to localStorage
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    cart.push(cartItem);
    localStorage.setItem("cart", JSON.stringify(cart));

    console.log("cartItem", cartItem);

    // Update UI
    cartCount();

    if (menuName !== 'Cooler Bag') {
        showCartNotification(cartItem);
    } else {
        let element = document.getElementsByClassName("sf_promo-container")[0];
        if (element) {
            window.scrollBy(0, -2 * window.innerHeight / 3);
            element.style.display = "none";
        } else {
            console.log("Element not found.");
        }
    }

    // ✅ Clear icing selection after adding to cart
}


async function resolveImage(imgSrc) {
    // ✅ If it's empty, return default
    if (!imgSrc) return "/images/default.png";

    // ✅ If it's already a blob, data URI, or proxied, just return as-is
    if (imgSrc.startsWith("blob:") || imgSrc.startsWith("data:") || imgSrc.includes("/SR/GetImageProxy")) {
        return imgSrc;
    }

    // ✅ Otherwise, treat as imageId and go through proxy
    return getImageUrl(imgSrc);
}

function showCartNotification(cartItem) {
    let Count = JSON.parse(localStorage.getItem("cart")) || [];
    const cartNotification = document.getElementById("cart-notification");
    const cartNotificationProduct = document.getElementById("cart-notification-product");
    const cartCountElement = document.getElementsByClassName("js-content-cart-count")[0];
    const count = sessionStorage.getItem("cartCount");

    console.log("Cart Count", count);

    // Clear previous content
    cartNotificationProduct.innerHTML = '';

    // ✅ Build icing line only if charges exist
    let icingLine = "";
    let cakeWritingLine = "";
    let cakeWriting = cartItem.cakeWriting;
    console.log("cakeWriting", cakeWriting);
    const icingCharge = parseFloat(cartItem.IcingCharges);
    if (!isNaN(icingCharge) && icingCharge > 0) {
        icingLine = `<p class="cart-notification-icing">Icing Picture: +$${icingCharge.toFixed(2)}</p>`;
    }
    if (cakeWriting) {
        cakeWritingLine = `<p class="cart-notification-cakeWriting">Cake Writing: ${cakeWriting}</p>`;
    }

    // ✅ Resolve image (binary vs proxy)
    const imgSrc = sessionStorage.getItem("coolerbagImgsrc");

    // Update the notification content
    cartNotificationProduct.innerHTML = `
        <div class="cart-notification-item">
            <img src="${cartItem.imgSrc}" alt="${cartItem.packageName}" class="cart-notification-item__image" style="width:30%" />
            <div class="cart-notification-item__details">
                <p class="cart-notification-item__name">
                  ${cartItem.packageName}${cartItem.packageType ? ` (${cartItem.packageType})` : ''} + SGD$ ${cartItem.itemPrice}
                </p>
                ${icingLine}
                ${cakeWritingLine}
                <p class="cart-notification-item__price">$${cartItem.total}</p>
            </div>
        </div>

        <a href="/SecretRecipe/Cart" id="cart-notification-button" class="button button--secondary button--full-width">
            View cart (<span class="js-content-cart-count">${Count.length}</span>)
        </a>

        <input type="hidden" name="_token" value="">
        <input type="hidden" name="current_currency" value="SGD">

        <a href="/SecretRecipe/Checkout" style="margin:5px;">
            <button type="button" class="button button--primary button--full-width" style="text-decoration:none;">
                Checkout
            </button>
        </a>

        <button type="button" class="link button-label" style="margin:5px;" onclick="document.getElementById('cart-notification').style.display='none';">
            Continue shopping
        </button>
    `;

    // Update cart count
    cartCountElement.textContent = parseInt(cartCountElement.textContent) + cartItem.quantity;

    // Show the cart notification with animation
    cartNotification.style.display = "block";
    cartNotification.classList.add('active');
    cartCount();
}
function addToCartCoolerPromo(event, menuPackage, productId, type, qty, menuName, unitPrice, img64, UOM, menuCtg) {
    // Prevent page refresh if it's a form submission or button click event
    if (event) {
        event.preventDefault();
    }
    let quantity = parseInt(qty);
    let total = parseFloat(quantity * unitPrice).toFixed(2);
    console.log(menuPackage, type, quantity, total, menuName, img64);

    let count = parseInt(sessionStorage.getItem("cartCount")) || 0;  // Ensure we parse the cart count as an integer or default to 0

    if (menuPackage !== '' && type !== '' && quantity) {  // Check if all necessary values are provided
        count++;  // Add the quantity to the cart count
        // Remove 'hidden' class from cart count bubble
        let cartCountBubbles = document.getElementsByClassName("cart-count-bubble");
        for (let i = 0; i < cartCountBubbles.length; i++) {
            cartCountBubbles[i].classList.remove('hidden');
        }
        // Update the cart count in the UI
        let cartCountElement = document.getElementsByClassName("js-content-cart-count")[0];
        if (cartCountElement) {
            cartCountElement.innerText = count;  // Update the text to show the new cart count
        }

        // Save the updated cart count to sessionStorage
        sessionStorage.setItem("cartCount", count);
    }

    // Create the cart item
    const cartItem = {
        menuPackage: menuPackage,
        packageName: menuName,
        packageType: type,
        itemPrice: unitPrice,
        quantity: quantity,
        total: total,
        imgSrc: img64,
        itemUOM: UOM,
        menuCtg: menuCtg,
        productId: productId
        /*price: itemPrice,*/  // Store price here
    };
    //document.getElementsByClassName("cart-notification").style.display = "block";
    // Update cart in localStorage
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    cart.push(cartItem);  // Push the new cart item
    localStorage.setItem("cart", JSON.stringify(cart));
    console.log("cartItem", cartItem);
    cartCount();
    if (menuName != 'Cooler Bag') {
        showCartNotification(cartItem);
    }
    else {
        var element = document.getElementsByClassName("sf_promo-container")[0];
        if (element) {
            window.scrollBy(0, -2 * window.innerHeight / 3);
            element.style.display = "none";
        } else {
            console.log("Element not found.");
        }
    };
}


function addToCartPromo(menuPackage, productId, UOM, addOnPrice, addOnQty, cooler) {

    //event, menuPackage, productId, type, qty, menuName, unitPrice, img64, UOM, menuCtg
    // Prevent page refresh if it's a form submission or button click event

    window.scrollTo(0, 0);

    //const promoCheckedItem = document.getElementById("PromoItemAddOnQty").checked || "";
    let quantity = 0;
    let total = 0;
    let cartItem = {};

    let cart = JSON.parse(localStorage.getItem("cart")) || [];

    if (menuPackage) {
        // Only add-on item selected
        quantity = parseInt(addOnQty);
        total = (quantity * addOnPrice).toFixed(2);
        cartItem = {
            menuPackage,
            itemPrice: addOnPrice,
            quantity,
            total,
            imgSrc: 'https://cdn.store-assets.com/s/896/i/75668520.jpeg',
            itemUOM: UOM,
            productId: productId,
            packageName: cooler,
            packageType: 'cooler'
        };
        cart.push(cartItem);

        localStorage.setItem("cart", JSON.stringify(cart));
        console.log("Updated cart in localStorage:", cart);


        // Update cart count
        let count = cart.reduce((total, item) => total + item.quantity, 0);  // Calculate total quantity
        // Update sessionStorage and UI
        sessionStorage.setItem("cartCount", count);
        let cartCountElement = document.getElementsByClassName("js-content-cart-count")[0];
        if (cartCountElement) {
            cartCountElement.innerText = count;
        }
        showCartNotification(cartItem);
    } else {
        return;
    }
    // Call cartCount function (assumed to be updating cart UI)
    cartCount();
}

function cartCount() {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const cartCount = cart.length; // Ensure cartCount is zero if cart is empty

    // Get the cart count element
    let cartCountElement = document.querySelector('.js-content-cart-count');

    // Check if the element exists before updating
    if (cartCountElement) {
        cartCountElement.innerText = cartCount;  // Update the cart count text
    }

    // Get all cart count bubbles
    let cartCountBubbles = document.getElementsByClassName("cart-count-bubble");

    // If cart has items, show the cart count bubble
    if (cartCountBubbles.length > 0) {
        for (let bubble of cartCountBubbles) {
            bubble.classList.remove('hidden');
        }
    }

    // Optionally hide the bubble again if cart is empty
    if (cartCount === 0) {
        for (let bubble of cartCountBubbles) {
            bubble.classList.add('hidden');
        }
    }
}




function deleteCart(itemId, index) {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const cartDiscount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];

    // Remove the item using the index, which is passed in as a parameter
    if (index !== undefined && cart.length > index) {
        cart.splice(index, 1);
        localStorage.setItem("cart", JSON.stringify(cart));
    }

    // Remove the item from the DOM immediately for instant feedback
    const rowToRemove = document.getElementById(`CartItem-${itemId}`);
    if (rowToRemove) {
        rowToRemove.remove();
    }

    // Recalculate the cart totals (including discounts if any)
    recalculateCartTotals(cart, cartDiscount);

    // Re-render the updated cart after removing the item
    renderCart();

    // Update the cart item count
    cartCount(); // Update cart count in the UI

    // Check if the cart is empty or has items and update the cart UI accordingly
    const cartCounts = cart.length;
    const cartItemsElement = document.querySelector('cart-items');
    const footerElement = document.querySelector('#main-cart-footer');

    // If the cart has items, show them; otherwise, show empty cart UI
    if (cartCounts > 0) {
        if (cartItemsElement) {
            cartItemsElement.classList.add('new-class');
            cartItemsElement.classList.remove('is-empty');
        }
        if (footerElement) {
            footerElement.classList.remove('is-empty');
        }
    } else {
        // If cart is empty, clear the cart-related localStorage
        localStorage.removeItem('cart'); // Only remove the cart, not everything
        if (cartItemsElement) {
            cartItemsElement.classList.remove('new-class');
            cartItemsElement.classList.add('is-empty');
            console.log('Cart is Empty.....');
        }
        if (footerElement) {
            footerElement.classList.add('is-empty');
        }
    }

    // Optionally, remove the deleted item from the DOM directly for instant feedback
    // already done above to ensure instant feedback
}

function renderCart() {
    window.scrollTo(0, 0);
    const coolerBagInfo = JSON.parse(sessionStorage.getItem("coolerBagInfo"));
    const itemImageSrcAddon = sessionStorage.getItem("coolerbagImgsrc");

    console.log("itemImageSrcAddon", itemImageSrcAddon);
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const cartDiscount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];
    const itemImageAddon = document.getElementById("ProductPhoto-slide01");

    let cartDiscountSubTotal = 0;
    let cartDisCode = '';
    if (cartDiscount && cartDiscount.length > 0) {
        cartDiscountSubTotal = parseFloat(cartDiscount[0].disSubTotal) || 0;
        cartDisCode = cartDiscount[0].discountCode || '';
    }

    const tbody = document.querySelector('.cart-items tbody');
    const subtotalElement = document.querySelector('.totals__subtotal-value');
    if (tbody) tbody.innerHTML = '';

    let subtotal = 0;
    let rowHTML = '';

    cart.forEach((item, index) => {
        const itemPrice = parseFloat(item.itemPrice) || 0;
        const icingCharges = parseFloat(item.IcingCharges) || 0;
        const quantity = parseInt(item.quantity) || 1;

        // Compute total for this item (price + icing) * quantity
        const itemTotal = (itemPrice + icingCharges) * quantity;
        subtotal += itemTotal;

        // Update item.total in the cart object for consistency
        item.total = itemTotal;

        const rowId = `CartItem-${item.menuPackage}-${index}`;

        // Determine image source: use cooler bag image if available, otherwise use cart item's image
        let itemImageSrc;
        if (item.packageName && item.packageName.toLowerCase().includes("cooler")) {
            // Cooler bag item
            itemImageSrc = itemImageSrcAddon;
            if (itemImageAddon) {
                itemImageAddon.src = itemImageSrc;
                itemImageAddon.style.width = "auto";
            }
            console.log("Using cooler bag image:", itemImageSrc);
        } else {
            // Regular cart item
            if (item.imgSrc && !item.imgSrc.startsWith("data:")) {
                // If it's just an ID, convert to URL
                itemImageSrc = getImageUrl(item.imgSrc);
            } else {
                itemImageSrc = item.imgSrc || '';
            }
        }

        const packageTypeHTML = item.packageType ? `<div class="product-option">${item.packageType}</div>` : '';
        const icingHTML = item.packageType && icingCharges
            ? `<div class="product-option">Icing Picture Size : ${item.packageType} + SGD$ ${icingCharges.toFixed(2)}</div>`
            : '';
        const cakeWriting = item.cakeWriting
            ? `<div class="product-option">Cake Writing : ${item.cakeWriting}</div>`
            : '';
        if (item.packageName && item.packageName.toLowerCase().includes("cooler")) {
            rowHTML = `
            <tr class="cart-item" id="${rowId}">
                <td class="cart-item__media">
                    <span>
                        <img class="cart-item__image" src="${itemImageSrc}" 
                             alt="${item.packageName || 'Product'}" 
                             loading="lazy" width="100" height="100">
                    </span>
                </td>
                <td class="cart-item__details">
                    <span class="cart-item__name break">
                        ${item.packageName}${item.packageType ? ` (${item.packageType})` : ''}
                    </span>
                    <dl>
                        ${icingHTML}
                    </dl>
                    <dl>
                        ${cakeWriting}
                    </dl>
                </td>
                <td class="cart-item__totals right medium-hide large-up-hide">
                    <div class="cart-item__price-wrapper">
                        <span class="price price--end">SGD$ ${itemTotal.toFixed(2)}</span>
                    </div>
                </td>
                <td class="cart-item__quantity">
                    <label class="visually-hidden" for="Quantity-${item.menuPackage}">Quantity</label>
                    <input type="hidden" name="ids[]" value="${item.menuPackage}">
                    <input type="hidden" name="item_ids[]" value="${item.menuPackage}">
                    <quantity-input class="quantity">
                        <button class="quantity__button no-js-hidden" name="minus" type="button" data-item-id="${item.menuPackage}" style="padding:17px;">
                            <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" role="presentation" class="icon icon-minus" fill="none" viewBox="0 0 10 2">
                                <path fill-rule="evenodd" clip-rule="evenodd" d="M.5 1C.5.7.7.5 1 .5h8a.5.5 0 110 1H1A.5.5 0 01.5 1z" fill="currentColor"></path>
                            </svg>
                        </button>
                        <input class="quantity__input" type="number" name="updates[]" value="${quantity}" min="0" aria-label="Quantity for ${item.packageName}" id="Quantity-${item.menuPackage}" data-item-id="${item.menuPackage}">
                        <button class="quantity__button no-js-hidden" name="plus" type="button" data-item-id="${item.menuPackage}" style="padding:17px;">
                            <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" role="presentation" class="icon icon-plus" fill="none" viewBox="0 0 10 10">
                                <path fill-rule="evenodd" clip-rule="evenodd" d="M1 4.51a.5.5 0 000 1h3.5l.01 3.5a.5.5 0 001-.01V5.5l3.5-.01a.5.5 0 00-.01-1H5.5L5.49.99a.5.5 0 00-1 .01v3.5l-3.5.01H1z" fill="currentColor"></path>
                            </svg>
                        </button>
                    </quantity-input>
                    <cart-remove-button id="Remove-${item.menuPackage}-${index}" data-index="${index}">
                        <a class="button button--tertiary" onclick="deleteCart('${item.menuPackage}', ${index})">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true" focusable="false" role="presentation" class="icon icon-remove">
                                <path d="M14 3h-3.53a3.07 3.07 0 00-.6-1.65C9.44.82 8.8.5 8 .5s-1.44.32-1.87.85A3.06 3.06 0 005.53 3H2a.5.5 0 000 1h1.25v10c0 .28.22.5.5.5h8.5a.5.5 0 00.5-.5V4H14a.5.5 0 000-1zM6.91 1.98c.23-.29.58-.48 1.09-.48s.85.19 1.09.48c.2.24.3.6.36 1.02h-2.9c.05-.42.17-.78.36-1.02zm4.84 11.52h-7.5V4h7.5v9.5z" fill="currentColor"></path>
                                <path d="M6.55 5.25a.5.5 0 00-.5.5v6a.5.5 0 001 0v-6a.5.5 0 00-.5-.5zM9.45 5.25a.5.5 0 00-.5.5v6a.5.5 0 001 0v-6a.5.5 0 00-.5-.5z" fill="currentColor"></path>
                            </svg>
                        </a>
                    </cart-remove-button>
                </td>
                <td class="cart-item__totals right small-hide">
                    <div class="cart-item__price-wrapper">
                        <span class="price price--end">SGD$ ${itemTotal.toFixed(2)}</span>
                    </div>
                </td>
            </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', rowHTML);
        }
        else {
            rowHTML = `
                <tr class="cart-item" id="${rowId}">
                    <td class="cart-item__media">
                        <a href="/SecretRecipe/Product/${item.menuPackage}" onclick="sessionStorage.setItem('menuPackage','${item.menuPackage}')">
                            <img class="cart-item__image" src="${itemImageSrc}" alt="${item.packageName || 'Product'}" loading="lazy" width="100" height="100">
                        </a>
                    </td>
                    <td class="cart-item__details">
                        <a href="/SecretRecipe/Product/${item.menuPackage}" class="cart-item__name break" onclick="sessionStorage.setItem('menuPackage','${item.menuPackage}')">
                            ${item.packageName}${item.packageType ? ` (${item.packageType})` : ''}
                        </a>
                        <dl>
                            ${icingHTML}
                        </dl>
                         <dl>
                             ${cakeWriting}
                        </dl>
                    </td>
                    <td class="cart-item__totals right medium-hide large-up-hide">
                        <div class="cart-item__price-wrapper">
                            <span class="price price--end">SGD$ ${itemTotal.toFixed(2)}</span>
                        </div>
                    </td>
                    <td class="cart-item__quantity">
                        <label class="visually-hidden" for="Quantity-${item.menuPackage}">Quantity</label>
                        <input type="hidden" name="ids[]" value="${item.menuPackage}">
                        <input type="hidden" name="item_ids[]" value="${item.menuPackage}">
                        <quantity-input class="quantity">
                            <button class="quantity__button no-js-hidden" name="minus" type="button" data-item-id="${item.menuPackage}" style="padding:17px;">
                                <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" role="presentation" class="icon icon-minus" fill="none" viewBox="0 0 10 2">
                                    <path fill-rule="evenodd" clip-rule="evenodd" d="M.5 1C.5.7.7.5 1 .5h8a.5.5 0 110 1H1A.5.5 0 01.5 1z" fill="currentColor"></path>
                                </svg>
                            </button>
                            <input class="quantity__input" type="number" name="updates[]" value="${quantity}" min="0" aria-label="Quantity for ${item.packageName}" id="Quantity-${item.menuPackage}" data-item-id="${item.menuPackage}">
                            <button class="quantity__button no-js-hidden" name="plus" type="button" data-item-id="${item.menuPackage}" style="padding:17px;">
                                <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" role="presentation" class="icon icon-plus" fill="none" viewBox="0 0 10 10">
                                    <path fill-rule="evenodd" clip-rule="evenodd" d="M1 4.51a.5.5 0 000 1h3.5l.01 3.5a.5.5 0 001-.01V5.5l3.5-.01a.5.5 0 00-.01-1H5.5L5.49.99a.5.5 0 00-1 .01v3.5l-3.5.01H1z" fill="currentColor"></path>
                                </svg>
                            </button>
                        </quantity-input>
                        <cart-remove-button id="Remove-${item.menuPackage}-${index}" data-index="${index}">
                            <a class="button button--tertiary" onclick="deleteCart('${item.menuPackage}', ${index})">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true" focusable="false" role="presentation" class="icon icon-remove">
                                    <path d="M14 3h-3.53a3.07 3.07 0 00-.6-1.65C9.44.82 8.8.5 8 .5s-1.44.32-1.87.85A3.06 3.06 0 005.53 3H2a.5.5 0 000 1h1.25v10c0 .28.22.5.5.5h8.5a.5.5 0 00.5-.5V4H14a.5.5 0 000-1zM6.91 1.98c.23-.29.58-.48 1.09-.48s.85.19 1.09.48c.2.24.3.6.36 1.02h-2.9c.05-.42.17-.78.36-1.02zm4.84 11.52h-7.5V4h7.5v9.5z" fill="currentColor"></path>
                                    <path d="M6.55 5.25a.5.5 0 00-.5.5v6a.5.5 0 001 0v-6a.5.5 0 00-.5-.5zM9.45 5.25a.5.5 0 00-.5.5v6a.5.5 0 001 0v-6a.5.5 0 00-.5-.5z" fill="currentColor"></path>
                                </svg>
                            </a>
                        </cart-remove-button>
                    </td>
                    <td class="cart-item__totals right small-hide">
                        <div class="cart-item__price-wrapper">
                            <span class="price price--end">SGD$ ${itemTotal.toFixed(2)}</span>
                        </div>
                    </td>
                </tr>
                `;
            tbody.insertAdjacentHTML('beforeend', rowHTML);

        }



        const currentRow = document.getElementById(rowId);
        const minusButton = currentRow.querySelector(`[name="minus"]`);
        const plusButton = currentRow.querySelector(`[name="plus"]`);
        if (minusButton) minusButton.addEventListener('click', () => updateQuantity(item.menuPackage, -1, index));
        if (plusButton) plusButton.addEventListener('click', () => updateQuantity(item.menuPackage, 1, index));
    });

    if (cartDiscountSubTotal > 0) {
        subtotalElement.textContent = `SGD$ ${cartDiscountSubTotal.toFixed(2)}`;
        document.getElementById("input-discount_code").value = cartDisCode;
        const button = document.querySelector('button[name="apply"]');
        button.textContent = 'REMOVE';
    } else {
        subtotalElement.textContent = `SGD$ ${subtotal.toFixed(2)}`;
        subtotalElement.setAttribute("value", subtotal.toFixed(2));
        sessionStorage.setItem("currentSubtotal", subtotal.toFixed(2));
    }

    // Save updated cart with correct totals back to localStorage
    localStorage.setItem("cart", JSON.stringify(cart));
}

function updateQuantity(itemId, change, index) {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const cartDiscount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];

    if (cart[index] && cart[index].menuPackage === itemId) {
        const item = cart[index];

        // Ensure quantity is a number
        let newQuantity = parseInt(item.quantity, 10) + change;
        let itemPrice = parseFloat(item.itemPrice);

        // Ensure quantity doesn’t fall below 1
        item.quantity = Math.max(1, newQuantity);
        item.total = (itemPrice * item.quantity).toFixed(2);

        // Update cart
        cart[index] = item;
        localStorage.setItem("cart", JSON.stringify(cart));

        // Recalculate totals and render
        recalculateCartTotals(cart, cartDiscount);
        renderCart();
    }
}



function recalculateCartTotals(cart, cartDiscount) {
    let subtotal = 0;
    let discountPercent = 0;

    // Check if there's any discount applied
    if (cartDiscount.length > 0) {
        discountPercent = parseFloat(cartDiscount[0]?.discountPercentage || 0); // Ensure discount is a float
    }

    // Recalculate the subtotal by iterating over each item
    cart.forEach(item => {
        const itemPrice = parseFloat(item.itemPrice) || 0;  // Ensure item price is a float
        const itemDiscount = itemPrice * (discountPercent / 100); // Calculate item discount as float
        subtotal += (itemPrice - itemDiscount) * item.quantity;
    });

    // Round the subtotal to two decimal places
    subtotal = parseFloat(subtotal.toFixed(2));

    // Update discount details in localStorage if there's any active discount
    if (cartDiscount.length > 0) {
        // Calculate original total (before discount)
        const oriTotal = parseFloat((subtotal + (subtotal * (discountPercent / 100))).toFixed(2)); // Ensure oriTotal is a float

        // Ensure that both disSubTotal and subTotal are the same
        cartDiscount[0].oriTotal = oriTotal;
        cartDiscount[0].disSubTotal = subtotal;  // Discounted subtotal
        cartDiscount[0].subTotal = subtotal;    // Same as disSubTotal
        localStorage.setItem("cartDiscountAmount", JSON.stringify(cartDiscount));
    }

    // Update the subtotal display
    updateCartSubtotal();
}


function updateCartSubtotal() {
    const cartDiscount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];
    const subtotalElement = document.querySelector('.totals__subtotal-value');

    // If there is a discount, show the discounted subtotal
    if (cartDiscount.length > 0) {
        const discountedSubtotal = parseFloat(cartDiscount[0].disSubTotal) || 0;
        subtotalElement.textContent = `SGD$ ${discountedSubtotal.toFixed(2)}`;
    } else {
        // If no discount, set subtotal to 0 or original value
        subtotalElement.textContent = `SGD$ 0.00`;
    }
}

function applyVoucherDiscount() {
    const discountCodeInput = document.getElementById('input-voucher_code');
    const applyButton = document.querySelector('#applyVoucher');
    const discountCode = discountCodeInput.value.trim();
    const cartPriceAmount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];
    const discount = getDiscountForCode(discountCode);
    const subtotalElement = document.querySelector('.total-line-subtotal_price');
    const subtotalText = subtotalElement.textContent.replace('SGD$ ', '').trim();
    const oriTotal = parseFloat(sessionStorage.getItem("currentSubtotal")).toFixed(2);
    let subtotal = parseFloat(subtotalText);
    let taxAmount = 0;
    const lift = document.getElementById("isunitatliftlevel").value;
    const selectedLift = document.getElementById("floorlevelcharges").value || '';
    let liftCharge = parseFloat(selectedLift?.cost) || 0;
    let liftCharges = parseFloat(sessionStorage.getItem("liftCharges"));
    let disCountedAmount = 0;

    // Parse and validate shipping fee
    let shippingFee = parseFloat(sessionStorage.getItem("deliveryCharges")) || 0;

    if (isNaN(subtotal)) {
        alert('Subtotal is not a valid number.');
        return;
    }

    // Check if valid discount is found
    if (!discount) {
        alert('Invalid voucher code.');
        return;
    }

    // Check if discount is already applied
    const existingDiscount = cartPriceAmount.find(item => item.discountCode === discountCode);

    if (existingDiscount) {
        alert('Voucher code is already applied. Removing the voucher.');
        // Reset subtotal to original
        subtotalElement.textContent = `SGD$ ${existingDiscount.subTotal}`;
        taxAmount = parseFloat(existingDiscount.subTotal) * gst;
        discountCodeInput.value = '';
        applyButton.textContent = 'APPLY';
        console.log("liftCharge", liftCharges);
        sessionStorage.setItem("discountAmount", 0);
        // Recalculate shipping fee
        updateShippingFee(shippingFee, liftCharges, lift, parseFloat(existingDiscount.subTotal));
        // Remove discount from cart
        const updatedCart = cartPriceAmount.filter(item => item.discountCode !== discountCode);
        localStorage.setItem("cartDiscountAmount", JSON.stringify(updatedCart));
        //checkout();
        return;
    }
    else {
        alert('Voucher code applied.');
        // Apply discount if not already applied
        const discountedSubtotal = subtotal - (subtotal * discount / 100);
        subtotalElement.textContent = `SGD$ ${discountedSubtotal.toFixed(2)}`;
        taxAmount = discountedSubtotal * gst;

        applyButton.textContent = 'REMOVE';

        if (lift === "N") {
            if (liftCharges) {
                // Adjust shipping fee based on discount

                shippingFee += liftCharges
                sessionStorage.setItem("discountAmount", (subtotal * discount / 100) + (shippingFee * discount / 100));
                disCountedAmount = (shippingFee * discount / 100) + (subtotal * discount / 100);
                shippingFee = shippingFee - (shippingFee * discount / 100);
                taxAmount = (discountedSubtotal + shippingFee) * gst
                subTotal = discountedSubtotal + shippingFee + taxAmount;
                document.querySelector("#shippingPrice").textContent = `SGD$ ${(shippingFee).toFixed(2)}`;
                document.querySelector(".total-line-tax_price").textContent = `SGD$ ${taxAmount.toFixed(2)}`;
                document.getElementById("total-price").textContent = `SGD$ ${subTotal.toFixed(2)}`;
                sessionStorage.setItem("Tax", parseFloat(taxAmount).toFixed(2));
                sessionStorage.setItem("Shipping", parseFloat(shippingFee));
                sessionStorage.setItem("SubTotal", parseFloat(subTotal));
            }
        }
        else {
            disCountedAmount = (shippingFee * discount / 100) + (subtotal * discount / 100);
            sessionStorage.setItem("discountAmount", disCountedAmount);
            shippingFee = shippingFee - (shippingFee * discount / 100);
            taxAmount = (discountedSubtotal + shippingFee) * gst;
            subTotal = discountedSubtotal + shippingFee + taxAmount;
            console.log("subTotal", subTotal);
            document.querySelector("#shippingPrice").textContent = `SGD$ ${(shippingFee).toFixed(2)}`;
            document.querySelector(".total-line-tax_price").textContent = `SGD$ ${taxAmount.toFixed(2)}`;
            document.getElementById("total-price").textContent = `SGD$ ${subTotal.toFixed(2)}`;
            sessionStorage.setItem("Tax", parseFloat(taxAmount).toFixed(2));
            sessionStorage.setItem("Shipping", parseFloat(shippingFee));
            sessionStorage.setItem("SubTotal", parseFloat(subTotal));
        }

        // Update cart with applied discount
        const updatedCart = [...cartPriceAmount.filter(item => !item.discountCode), {
            oriTotal: oriTotal,
            subTotal: subtotal.toFixed(2),
            disSubTotal: discountedSubtotal.toFixed(2),
            discountCode,
            discountAmt: disCountedAmount.toFixed(2),
            discountPercentage: (discount / 100).toFixed(2)
        }];


        localStorage.setItem("cartDiscountAmount", JSON.stringify(updatedCart));
        // Update tax and shipping details
        //checkout();
    }
}

// Helper function for shipping fee updates
function updateShippingFee(shippingFee, liftCharges, lift, oriTotal) {

    if (lift === 'N') {
        if (shippingFee > 0) {
            shippingFee = shippingFee + liftCharges;
            document.querySelector("#shippingPrice").textContent = `SGD$ ${(shippingFee).toFixed(2)}`;
            document.getElementById("shipping-price").textContent = `Charge : SGD$ ${shippingFee.toFixed(2)}`;
            Tax = (oriTotal + shippingFee) * gst;
            document.querySelector(".total-line-tax_price").textContent = `SGD$ ${(Tax).toFixed(2)}`;
            Total = parseFloat(oriTotal) + parseFloat(shippingFee) + parseFloat(Tax);
            document.getElementById("total-price").textContent = `SGD$ ${Total.toFixed(2)}`;
            console.log("Total", Total);
            sessionStorage.setItem("Tax", parseFloat(Tax).toFixed(2));
            sessionStorage.setItem("Shipping", parseFloat(shippingFee));
            sessionStorage.setItem("SubTotal", parseFloat(Total));
        }
    }
    else {
        if (shippingFee > 0) {
            document.querySelector("#shippingPrice").textContent = `SGD$ ${shippingFee.toFixed(2)}`;
            document.getElementById("shipping-price").textContent = `Charge : SGD$ ${shippingFee.toFixed(2)}`;
            Tax = (oriTotal + shippingFee) * gst;
            document.querySelector(".total-line-tax_price").textContent = `SGD$ ${(Tax).toFixed(2)}`;
            Total = parseFloat(oriTotal) + parseFloat(shippingFee) + parseFloat(Tax);
            document.getElementById("total-price").textContent = `SGD$ ${Total.toFixed(2)}`;
            console.log("Totalsss", Total);
            sessionStorage.setItem("Tax", parseFloat(Tax).toFixed(2));
            sessionStorage.setItem("Shipping", parseFloat(shippingFee));
            sessionStorage.setItem("SubTotal", parseFloat(Total));

        } else {
            Tax = oriTotal * gst;
            document.querySelector(".total-line-tax_price").textContent = `SGD$ ${(Tax).toFixed(2)}`;
            Total = parseFloat(oriTotal) + parseFloat(Tax);
            document.getElementById("total-price").textContent = `SGD$ ${Total.toFixed(2)}`;
            console.log("Totalsss", Total);
        }
    }

}


function applyDiscount() {
    const discountCodeInput = document.getElementById('input-discount_code');
    const applyButton = document.getElementById('apply-discount-button');
    const discountCode = discountCodeInput.value;
    const cartPriceAmount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];
    const discount = getDiscountForCode(discountCode); // Get the discount percentage or amount
    const subtotalElement = document.querySelector('#cartSubTotal');
    let subtotalText = subtotalElement.textContent.replace('SGD$ ', '').trim(); // Get the text content and remove the 'SGD$' prefix
    let oriTotal = parseFloat(sessionStorage.getItem("currentSubtotal")).toFixed(2);

    // Convert to number
    let subtotal = parseFloat(subtotalText);

    if (isNaN(subtotal)) {
        alert('Subtotal is not a valid number.');
        return;
    }

    if (discount) {
        const button = document.querySelector('button[name="apply"]');

        // Check if a discount is already applied
        const existingDiscount = cartPriceAmount.find(item => item.discountCode);

        if (existingDiscount && existingDiscount.discountCode === discountCode) {
            // If the same discount code is applied, remove it (revert the cart)
            alert('Discount code is already applied. Reapplying the discount.');
            button.textContent = 'APPLY';
            // Reset the cart to original values
            subtotalElement.textContent = 'SGD$ ' + existingDiscount.oriTotal;
            document.querySelector('#input-discount_code').value = "";
            // Clear the discount details in localStorage
            const updatedCart = cartPriceAmount.filter(item => !item.discountCode);
            localStorage.setItem("cartDiscountAmount", JSON.stringify(updatedCart));

            // Enable the apply button again
            if (applyButton) {
                applyButton.disabled = false;
            }

            renderCart(); // Re-render the cart without the discount
            return;
        } else {
            // Apply discount to the subtotal
            const discountedSubtotal = subtotal - (subtotal * discount / 100);

            // Update the cart with the discounted subtotal
            updateCartSubtotal(discountedSubtotal);

            // Optionally update the displayed subtotal
            subtotalElement.textContent = 'SGD$ ' + discountedSubtotal.toFixed(2);

            // Add the new discount entry
            alert('Discount applied!');
            button.textContent = 'REMOVE';
            // Remove old discount entry if it exists (to avoid duplicate discount entries)
            const updatedCart = cartPriceAmount.filter(item => !item.discountCode);

            // Add new discount details to the cart
            updatedCart.push({
                oriTotal: parseFloat(oriTotal).toFixed(2),
                subTotal: parseFloat(subtotal).toFixed(2),
                disSubTotal: parseFloat(discountedSubtotal).toFixed(2),
                discountCode: discountCode,
                discountAmt: parseFloat((oriTotal * discount / 100)).toFixed(2),
                discountPercentage: parseFloat((discount / 100)).toFixed(2)
            });

            // Update the localStorage with the updated cart
            localStorage.setItem("cartDiscountAmount", JSON.stringify(updatedCart));

            // Disable the apply button after discount code is applied
            if (applyButton) {
                applyButton.disabled = true;
            }

            renderCart(); // Re-render the cart with the new discount
        }

    } else {
        alert('Invalid discount code.');
    }
}

function updateCartSubtotal() {
    // Retrieve cart and discount data from local storage
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const cartDiscount = JSON.parse(localStorage.getItem("cartDiscountAmount")) || [];

    let subtotal = 0;

    // Calculate the subtotal
    cart.forEach(item => {
        const itemPrice = parseFloat(item.itemPrice) || 0; // Ensure valid number
        subtotal += itemPrice * (item.quantity || 0);
    });

    // Apply discount if available
    let discountedSubtotal = subtotal;
    if (cartDiscount.length > 0 && cartDiscount[0]?.discountPercentage) {
        const discountPercentage = parseFloat(cartDiscount[0].discountPercentage) || 0; // Ensure valid percentage
        const discountAmount = subtotal * discountPercentage;
        discountedSubtotal = subtotal - discountAmount;

        // Update discount details in local storage
        Object.assign(cartDiscount[0], {
            oriTotal: subtotal.toFixed(2),
            disSubTotal: discountedSubtotal.toFixed(2),
            discountAmt: discountAmount.toFixed(2),
        });
        localStorage.setItem("cartDiscountAmount", JSON.stringify(cartDiscount));
    }

    // Update the subtotal display
    const subtotalElement = document.querySelector('.totals__subtotal-value');
    if (subtotalElement) {
        subtotalElement.textContent = `SGD$ ${discountedSubtotal.toFixed(2)}`;
    }

    // Store the current subtotal in session storage
    sessionStorage.setItem("currentSubtotal", discountedSubtotal.toFixed(2));

    // Re-render the cart
    renderCart();
}


function getDiscountForCode(code) {
    // Define some example discount codes and their corresponding discount percentages
    const discountCodes = {
        'DISCOUNT10': 10,  // 10% discount
        'DISCOUNT20': 20,  // 20% discount
        'BLACKFRIDAY': 50 // 50% discount
    };

    return discountCodes[code.toUpperCase()] || 0; // Default to 0 if the code is not found
}


function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


// Function to fetch pickup outlets
function GetPickUpOutlets() {
    $.ajax({
        type: "GET",
        dataType: "json",
        url: "/SR/Outlets",
        success: function (data) {
            const parsedData = data.data ? JSON.parse(data.data) : data;
            console.log("Response:", parsedData);

            const outlets = parsedData.response.data || [];
            let orgId = sessionStorage.getItem("Organization");

            const pickUpOutletEl = document.getElementById("pickUpOutlet");
            const operatingHoursEl = document.getElementById("OperatingHours");
            operatingHoursEl.innerHTML = "Please select an outlet";

            let outletHtml = '';

            for (let i = 0; i < outlets.length; i++) {
                const outlet = outlets[i];
                const OutletName = outlet._identifier;
                const warehouse_id = outlet.warehouseOutlet;
                const OutletAdd1 = outlet.addressLine1 || "";
                const OutletAdd2 = outlet.addressLine2 || "";
                const OutletPostal = outlet.postalCode || "";
                const OutletOpsHrs = outlet.operatingHours || "N/A";

                const addressParts = [OutletAdd1, OutletAdd2, OutletPostal]
                    .map(part => part ? part.trim() : '')
                    .filter(part => part !== '');
                const fullAddress = addressParts.join(', ');

                outletHtml += `
                  <label class="delivery_save_trigger option-box card-toggle media" for="pickups-easystore-pickup-${i}">
                    <input type="radio" 
                      name="checkout[delivery_method]" 
                      data-title="${escapeHtml(OutletName)}"
                      data-warehouse-id="${escapeHtml(warehouse_id)}"
                      data-operating-hours="${escapeHtml(OutletOpsHrs)}"
                      value="${escapeHtml(fullAddress)}"
                      id="pickups-easystore-pickup-${i}">
                    <span class="media-control">
                      <b class="name"><i class="fas fa-map-marker-alt text-danger"></i> ${escapeHtml(OutletName)}</b>
                      <div class="address">${escapeHtml(fullAddress)} Singapore</div>
                    </span>
                  </label>`;


            }

            pickUpOutletEl.innerHTML = outletHtml;

            attachEventListeners();

            // Select first radio by default and trigger change to update operating hours UI
            const firstRadio = document.querySelector('input[name="checkout[delivery_method]"]');
            if (firstRadio) {
                firstRadio.checked = true;
                firstRadio.dispatchEvent(new Event('change'));
            }
        },
        error: function (xhr, status, error) {
            console.error("Error fetching data:", error);
        }
    });
}

function resetDeliveryMethodValidation() {
    const warning = document.getElementById('delivery-methods-placeholder');
    if (warning) warning.style.display = 'none';
    // Reset other validation UI or state flags here
}
let preventModalShow = false;

$(document).on("click", "#shipping_modal_save, input[name='shipping_handle']", function (e) {
    e.stopPropagation();
    preventModalShow = true;  // prevent reopening modal

    console.log("shipping_modal_save or shipping_handle clicked");

    // Update selected shipping info
    const selectedOption = $("input[name='shipping_handle']:checked");
    const deliveryPriceAttr = selectedOption.attr("data-price");
    const deliveryCharges = parseFloat(deliveryPriceAttr);
    const shippingTitle = selectedOption.attr("data-title");

    document.getElementById("shipping-title").innerText = shippingTitle;

    if (!isNaN(deliveryCharges)) {
        calculateCharges(deliveryCharges);
        $('.btn-arrow').show();
    }
    $('#shippingModal').modal('hide');

});


// 🟢 Open modal with Bootstrap when summary is clicked
$(document).on("click", "#shipping-summary", function () {
    $('#shippingModal').modal('show');
});


function GetMenuPack() {
    Menupakage();
}

function GetPromotion() {
    $.ajax({
        type: "GET",
        dataType: "json",
        url: "/SR/GetPromotion",
        success: function (data) {
            try {
                const promotionItems = data?.response?.data;
                const container = document.getElementById("SliderPromotion");
                if (!Array.isArray(promotionItems) || promotionItems.length === 0 || !container) return;

                // Filter out expired promotions
                const currentDate = new Date();
                const validPromotions = promotionItems.filter(item => {
                    if (!item.validTo) return true; // Include if no expiry date

                    const validToDate = new Date(item.validTo);
                    const isValid = validToDate >= currentDate;

                    if (!isValid) {
                        console.log(`Filtered expired promotion: ${item.name} (expired: ${item.validTo})`);
                    }

                    return isValid;
                });

                if (validPromotions.length === 0) {
                    console.log("No valid promotions available");
                    return;
                }

                // Sort: move empty-image items to the end
                const sortedItems = validPromotions.slice().sort((a, b) => {
                    const aHasImage = a.promotionImage && a.promotionImage.trim() !== "";
                    const bHasImage = b.promotionImage && b.promotionImage.trim() !== "";
                    return (aHasImage === bHasImage) ? 0 : aHasImage ? -1 : 1;
                });

                const itemsWithImages = sortedItems.filter(item =>
                    item.promotionImage && item.promotionImage.trim() !== ""
                );

                if (itemsWithImages.length === 0) return;

                // Inject styles first
                injectPromotionStyles();

                // Initialize DOM structure
                initializePromotionDOM(container, sortedItems, itemsWithImages);

                // Add scroll banner for items without images
                addScrollBanner(sortedItems);
            } catch (error) {
                console.error("Error processing promotion data:", error);
            }
        },
        error: function (xhr, status, error) {
            console.error("Failed to load promotions:", status, error);
        }
    });
}

function initializePromotionDOM(container, sortedItems, itemsWithImages) {
    container.innerHTML = '';

    // Create main container
    const mainContainer = document.createElement("div");
    mainContainer.className = "promotions-container";
    container.appendChild(mainContainer);

    // Title & subtitle
    const title = document.createElement("h1");
    title.className = "promotions-title";
    title.textContent = "What's New";
    mainContainer.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "promotions-subtitle";
    subtitle.textContent = "Check out our latest promotions!";
    mainContainer.appendChild(subtitle);

    // Desktop Carousel
    const carouselContainer = document.createElement("div");
    carouselContainer.className = "carousel-container";
    mainContainer.appendChild(carouselContainer);

    const carouselSlide = document.createElement("div");
    carouselSlide.className = "carousel-slide";
    carouselContainer.appendChild(carouselSlide);

    // Group promotions into sections of 3
    const promotionSections = [];
    for (let i = 0; i < itemsWithImages.length; i += 3) {
        promotionSections.push(itemsWithImages.slice(i, i + 3));
    }

    // Create promotion sections
    promotionSections.forEach((sectionPromos) => {
        const section = document.createElement("div");
        section.className = "promotion-section";

        const promosContainer = document.createElement("div");
        promosContainer.className = "promotions-grid";
        section.appendChild(promosContainer);

        sectionPromos.forEach((item) => {
            const promoCard = document.createElement("div");
            promoCard.className = "promotion-card";
            promoCard.style.boxShadow = "5px 5px 10px 0px rgba(0,0,0,.35)";
            promoCard.style.borderRadius = "10px";

            const imgContainer = document.createElement("div");
            imgContainer.className = "promotion-img-container";

            const promoImg = document.createElement("img");
            promoImg.className = "promotion-img";
            promoImg.alt = item.promotionName || "Special Promotion";
            promoImg.loading = "lazy";
            promoImg.src = /^data:image/.test(item.promotionImage)
                ? item.promotionImage
                : `data:image/png;base64,${item.promotionImage}`;

            imgContainer.appendChild(promoImg);
            promoCard.appendChild(imgContainer);

            if (item.description) {
                const promoContent = document.createElement("div");
                promoContent.className = "promotion-content";

                const promoDesc = document.createElement("div");
                promoDesc.className = "promotion-description";
                promoDesc.textContent = item.description;

                promoContent.appendChild(promoDesc);
                promoCard.appendChild(promoContent);
            }

            promosContainer.appendChild(promoCard);
        });

        carouselSlide.appendChild(section);
    });

    // Desktop navigation buttons
    if (promotionSections.length > 1) {
        const navButtons = document.createElement("div");
        navButtons.className = "carousel-nav";
        carouselContainer.appendChild(navButtons);

        const prevButton = document.createElement("button");
        prevButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        prevButton.onclick = () => prevSlide();
        prevButton.setAttribute("aria-label", "Previous slide");
        navButtons.appendChild(prevButton);

        const nextButton = document.createElement("button");
        nextButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M9 18L15 12L9 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        nextButton.onclick = () => nextSlide();
        nextButton.setAttribute("aria-label", "Next slide");
        navButtons.appendChild(nextButton);
    }

    // Desktop slider dots
    const desktopDotsContainer = document.createElement("div");
    desktopDotsContainer.className = "desktop-dots-container";
    carouselContainer.appendChild(desktopDotsContainer);

    const desktopDots = [];
    if (promotionSections.length > 1) {
        promotionSections.forEach((_, index) => {
            const dot = document.createElement("span");
            dot.className = "desktop-dot";
            if (index === 0) dot.classList.add("active");
            dot.onclick = () => goToSlide(index);
            desktopDotsContainer.appendChild(dot);
            desktopDots.push(dot);
        });
    }

    // Mobile Carousel
    const mobileCarouselContainer = document.createElement("div");
    mobileCarouselContainer.className = "mobile-carousel-container";
    mainContainer.appendChild(mobileCarouselContainer);

    const mobileCarouselSlide = document.createElement("div");
    mobileCarouselSlide.className = "mobile-carousel-slide";
    mobileCarouselContainer.appendChild(mobileCarouselSlide);

    // Create mobile slides
    itemsWithImages.forEach((item) => {
        const mobileSlide = document.createElement("div");
        mobileSlide.className = "mobile-promotion-slide";

        const promoCard = document.createElement("div");
        promoCard.className = "promotion-card";
        promoCard.style.boxShadow = "5px 5px 10px 0px rgba(0,0,0,.35)";
        promoCard.style.borderRadius = "10px";

        const imgContainer = document.createElement("div");
        imgContainer.className = "promotion-img-container";

        const promoImg = document.createElement("img");
        promoImg.className = "promotion-img";
        promoImg.alt = item.promotionName || "Special Promotion";
        promoImg.loading = "lazy";
        promoImg.src = /^data:image/.test(item.promotionImage)
            ? item.promotionImage
            : `data:image/png;base64,${item.promotionImage}`;

        imgContainer.appendChild(promoImg);
        promoCard.appendChild(imgContainer);

        if (item.description) {
            const promoContent = document.createElement("div");
            promoContent.className = "promotion-content";

            const promoDesc = document.createElement("div");
            promoDesc.className = "promotion-description";
            promoDesc.textContent = item.description;

            promoContent.appendChild(promoDesc);
            promoCard.appendChild(promoContent);
        }

        mobileSlide.appendChild(promoCard);
        mobileCarouselSlide.appendChild(mobileSlide);
    });

    // Mobile slider dots
    const mobileSliderDots = document.createElement("div");
    mobileSliderDots.className = "mobile-slider-dots-container";
    mainContainer.appendChild(mobileSliderDots);

    const mobileDots = [];
    itemsWithImages.forEach((_, index) => {
        const dot = document.createElement("span");
        dot.className = "mobile-dot";
        if (index === 0) dot.classList.add("active");
        dot.onclick = () => {
            mobileCurrentIndex = index;
            updateMobileCarousel();
        };
        mobileSliderDots.appendChild(dot);
        mobileDots.push(dot);
    });

    // Carousel control variables
    let currentSlide = 0;
    let mobileCurrentIndex = 0;
    let slideInterval;

    // Desktop carousel functions
    function updateCarousel() {
        const offset = -currentSlide * 100;
        carouselSlide.style.transform = `translateX(${offset}%)`;
        desktopDots.forEach((dot, index) => {
            dot.classList.toggle("active", index === currentSlide);
        });
    }

    function goToSlide(index) {
        currentSlide = index;
        updateCarousel();
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % promotionSections.length;
        updateCarousel();
    }

    function prevSlide() {
        currentSlide = (currentSlide - 1 + promotionSections.length) % promotionSections.length;
        updateCarousel();
    }

    // Mobile carousel functions
    function updateMobileCarousel() {
        const offset = -mobileCurrentIndex * 100;
        mobileCarouselSlide.style.transform = `translateX(${offset}%)`;
        mobileDots.forEach((dot, index) => {
            dot.classList.toggle("active", index === mobileCurrentIndex);
        });
    }

    // Swipe handling for mobile
    let mobileStartX = 0;
    let mobileEndX = 0;

    mobileCarouselContainer.addEventListener("touchstart", (e) => {
        mobileStartX = e.touches[0].clientX;
    }, { passive: true });

    mobileCarouselContainer.addEventListener("touchend", (e) => {
        mobileEndX = e.changedTouches[0].clientX;
        const delta = mobileEndX - mobileStartX;
        if (Math.abs(delta) > 50) {
            if (delta < 0) {
                mobileCurrentIndex = (mobileCurrentIndex + 1) % itemsWithImages.length;
            } else {
                mobileCurrentIndex = (mobileCurrentIndex - 1 + itemsWithImages.length) % itemsWithImages.length;
            }
            updateMobileCarousel();
        }
    }, { passive: true });

    // Initialize carousels
    updateCarousel();
    updateMobileCarousel();

    // Auto-advance slides
    function startAutoSlide() {
        if (promotionSections.length > 1) {
            slideInterval = setInterval(nextSlide, 5000);
        }
    }

    function pauseAutoSlide() {
        clearInterval(slideInterval);
    }

    startAutoSlide();

    // Pause on hover
    carouselContainer.addEventListener('mouseenter', pauseAutoSlide);
    carouselContainer.addEventListener('mouseleave', startAutoSlide);

    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        pauseAutoSlide();
        resizeTimer = setTimeout(function () {
            updateCarousel();
            updateMobileCarousel();
            startAutoSlide();
        }, 250);
    });

    // Touch support for desktop
    let touchStartX = 0;
    let touchEndX = 0;

    carouselContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        pauseAutoSlide();
    }, { passive: true });

    carouselContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
        startAutoSlide();
    }, { passive: true });

    function handleSwipe() {
        const threshold = 50;
        if (touchStartX - touchEndX > threshold) {
            nextSlide();
        } else if (touchEndX - touchStartX > threshold) {
            prevSlide();
        }
    }
}

function addScrollBanner(sortedItems) {
    const promoScrollBanner = document.getElementById("promoScrollBanner");
    if (!promoScrollBanner) return;

    let count = 0;
    sortedItems.forEach(item => {
        const hasImage = item.promotionImage && item.promotionImage.trim() !== "";
        if (!hasImage && item.description?.trim() && count < 2) {
            const scrollText = `<span>${item.description} &nbsp;&nbsp;</span>`.repeat(6);
            promoScrollBanner.innerHTML += `<div class="scrolling-text">${scrollText}</div>`;
            count++;
        }
    });

    if (count > 0) {
        const slickSlide = document.getElementById("slick-slide");
        if (slickSlide) slickSlide.style.display = "block";
    }
}

function injectPromotionStyles() {
    if (document.getElementById('promotion-styles')) return;

    const styleTag = document.createElement("style");
    styleTag.id = 'promotion-styles';
    styleTag.innerHTML = `
        .promotions-container {
            max-width: 1280px;
            margin: 0 auto;
            padding: 2rem 1.5rem;
            font-family: 'Segoe UI', Roboto, sans-serif;
        }

        .promotions-title {
            text-align: center;
            margin-bottom: 0.75rem;
            letter-spacing: -0.5px;
            position: relative;
            display: inline-block;
            left: 50%;
            transform: translateX(-50%);
        }

        .promotions-title:after {
            content: '';
            position: absolute;
            bottom: -8px;
            left: 0;
            width: 100%;
            height: 3px;
            border-radius: 3px;
        }

        .promotions-subtitle {
            text-align: center;
            font-size: 1.4rem;
            line-height: 1.6;
            max-width: 700px;
            margin-left: auto;
            margin-right: auto;
            color: #636e72;
        }

        /* Carousel Container */
        .carousel-container {
            max-width: 1280px;
            margin: 0 auto;
            padding: 2rem 1.5rem;
            position: relative;
            font-family: 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
        }

        .carousel-slide {
            display: flex;
            transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            will-change: transform;
        }

        .promotion-section {
            flex: 0 0 100%;
            box-sizing: border-box;
            padding: 0 1rem;
        }

        /* Promotions Grid */
        .promotions-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.5rem;
            margin: 6rem;
        }

        /* Promotion Card */
        .promotion-card {
            transition: all 0.4s ease;
            overflow: hidden;
            position: relative;
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        .promotion-img-container {
            position: relative;
            overflow: hidden;
            flex-shrink: 0;
        }

        .promotion-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s ease;
        }

        .promotion-card:hover .promotion-img {
            transform: scale(1.05);
        }

        .promotion-content {
            padding: 1.5rem;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            background: #fff6e8;
            min-height: 120px;
            justify-content: center;
        }

        .promotion-description {
            text-align: center;
            font-weight: 600;
            font-size: 1.5rem;
            color: #2d3436;
            line-height: 1.4;
            font-family: 'Segoe UI', sans-serif;
            width: 100%;
        }

        /* Navigation Arrows */
        .carousel-nav {
            position: absolute;
            top: 50%;
            width: calc(100% - 4rem);
            left: 2rem;
            transform: translateY(-50%);
            display: flex;
            justify-content: space-between;
            pointer-events: none;
            z-index: 10;
        }

        .carousel-nav button {
            pointer-events: all;
            background: white;
            border: none;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .carousel-nav button:hover {
            transform: scale(1.1);
            background: #e74c3c;
        }

        .carousel-nav button:hover svg {
            stroke: white;
        }

        .carousel-nav button svg {
            width: 24px;
            height: 24px;
            stroke: #e74c3c;
            stroke-width: 2;
        }

        /* Desktop Slider Dots */
        .desktop-dots-container {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-top: 1.5rem;
            padding: 0.5rem;
        }

        .desktop-dot {
            width: 11px;
            height: 11px;
            border-radius: 50%;
            background-color: #dfe6e9;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .desktop-dot.active {
            background-color: #e74c3c;
            transform: scale(1.2);
        }

        /* Mobile Slider Dots */
        .mobile-slider-dots-container {
            display: none;
            justify-content: center;
            gap: 6px;
            margin-top: 1.5rem;
        }

        .mobile-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: #dfe6e9;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .mobile-dot.active {
            background-color: #e74c3c;
            transform: scale(1.2);
        }

        /* Mobile Carousel */
        .mobile-carousel-container {
            display: none;
        }

        .mobile-carousel-slide {
            display: flex;
            transition: transform 0.6s ease;
            will-change: transform;
        }

        .mobile-promotion-slide {
            flex: 0 0 100%;
            box-sizing: border-box;
            padding: 5px 2rem;
        }

        /* Responsive Styles */
        @media (max-width: 1024px) {
            .promotion-img-container {
                height: 350px;
            }
        }

        @media (max-width: 768px) {
            .promotions-container {
                padding: 1.5rem 1rem;
            }

            .promotions-title {
                font-size: 1.8rem;
            }

            .carousel-container {
                padding: 0;
                display: none;
            }

            .promotions-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
            }

            .promotion-section {
                padding: 0 0;
            }

            .carousel-nav button {
                display: none;
            }

            .desktop-dots-container {
                display: none;
            }

            .mobile-slider-dots-container {
                display: flex;
                padding: 2.5rem;
            }

            .mobile-carousel-container {
                display: block;
                overflow: hidden;
                position: relative;
            }

            .slide-wrapper {
                flex: 0 0 100%;
                justify-content: center;
                padding: 1rem 3rem;
            }

            .slide-item {
                flex: 0 0 100%;
                max-width: 100%;
            }
        }

        @media (max-width: 480px) {
            .promotions-grid {
                grid-template-columns: repeat(1, 1fr);
                gap: 1.25rem;
                margin: 0;
            }

            .promotion-img-container {
                height: 420px;
            }

            .promotion-description {
                font-size: 12px;
            }

            .promotion-content {
                padding: 1.25rem;
            }

            .promotions-title {
                font-size: 30px;
            }

            .promotions-subtitle {
                font-size: 1.4rem;
                margin-bottom: 2rem;
            }
        }
    `;
    document.head.appendChild(styleTag);
}

// Function to update the UI for delivery method
//function updateUIForDeliveryMethod(isPickup, pickupName, pickupAddressText) {
//    const alertInfo = document.querySelector('.alert.alert-info.mt-3');
//    const pickupSection = document.getElementById('pickup-section');
//    const pickup_address = document.getElementById('pickup_address');
//    const location_details = document.getElementById('location_details_wrapper');
//    const deliveryMethod = document.getElementById('delivery_method');
//    const pickup_datepicker = document.getElementById('pickup_datepicker');
//    const receiver_section = document.getElementById('receiver_section');
//    const shipping_warpper = document.getElementById('shipping-address-section');
//    const shipping_methods = document.getElementById('shipping_methods');
//    const billing_radio = document.getElementById('billing-address-radio');
//    const billing_form = document.getElementById('billing-address-form-wrapper');
//    const shippingDesc = document.getElementById('shippingDesc');
//    const shippingPrice = document.getElementById('shippingPrice');
//    const pickupTitle = document.getElementById("pickup_title");
//    const pickupAddress = document.getElementById("pickAddress");

//    alertInfo.classList.add('skeleton-loading');
//    requestAnimationFrame(() => {
//        console.log("Updating UI for", isPickup ? "pickup" : "shipping");

//        // Toggle visibility based on the delivery method
//        pickupSection.style.display = isPickup ? 'block' : 'none';
//        pickup_address.style.display = isPickup ? 'block' : 'none';
//        location_details.style.display = isPickup ? 'block' : 'none';
//        deliveryMethod.style.display = isPickup ? 'block' : 'none';
//        pickup_datepicker.style.display = isPickup ? 'block' : 'none';
//        receiver_section.style.display = isPickup ? 'block' : 'none';
//        shipping_warpper.style.display = isPickup ? 'none' : 'block';
//        shipping_methods.style.display = isPickup ? 'none' : 'block';
//        billing_radio.style.display = isPickup ? 'none' : 'block';
//        billing_form.style.display = isPickup ? 'block' : 'none';

//        // Update Pickup Details
//        pickupTitle.innerText = pickupName || "Select a Pickup Location";
//        pickupAddress.innerText = pickupAddressText || "No address provided";
//        alertInfo.classList.remove('skeleton-loading');

//        if (isPickup) {
//            // Set session storage values
//            sessionStorage.setItem("Shipping", 0);
//            sessionStorage.setItem("deliveryCharges", 0);
//            sessionStorage.setItem("Tax", 0);
//            sessionStorage.setItem("liftCharges", 0);
//            shippingDesc.style.display = "block";
//            shippingPrice.style.display = "none";

//            // Close & remove modal properly
//            //const modal = document.querySelector('.modal.fade.show');
//            //if (modal) {
//            //    modal.classList.remove('show');
//            //    modal.style.display = 'none';
//            //}
//            //document.querySelectorAll('.modal-backdrop, .modal').forEach(el => el.remove());
//            //document.body.classList.remove('modal-open');
//            //document.body.style.overflow = '';
//            //document.body.style.paddingRight = '';

//            document.getElementById("applyVoucher").disabled = false;
//            loadCollectionTime();  // Ensure this function is defined
//        } else {
//            shippingDesc.style.display = "none";
//            shippingPrice.style.display = "block";
//            const modal = document.querySelector('.modal.fade');
//            if (modal) {
//                modal.classList.add('.show');
//                modal.style.display = 'block';
//            }
//            document.querySelectorAll('.modal-backdrop, .modal').forEach(el => el.add());
//            document.body.classList.add('modal-open');
//            document.body.style.overflow = '';
//            document.body.style.paddingRight = '';

//            // Handle postal code validation for shipping method
//            document.getElementById('shipping-zip').addEventListener('input', function (event) {
//                let postalCode = event.target.value.trim();
//                if (/^\d{6}$/.test(postalCode)) {
//                    let lastTwoDigits = postalCode.slice(-2);
//                    console.log("Last Two Digits:", lastTwoDigits);
//                    calculateCharges(lastTwoDigits); // Ensure this function is defined
//                } else {
//                    let price = 0;
//                    shippingPrice.textContent = `SGD$ ${price.toFixed(2)}`;
//                }
//            });
//        }
//    });
//}

// Calling the function to fetch outlets on page load
//GetPickUpOutlets();



//// Function to fetch pickup outlets
//function GetPickUpOutlets() {
//    $.ajax({
//        type: "GET",
//        dataType: "json",
//        url: "/SR/Outlets", // Change this to your actual API endpoint
//        success: function (data) {
//            const parsedData = data.data ? JSON.parse(data.data) : data;
//            console.log("Response:", parsedData);

//            var count = parsedData.response.data.length;

//            // Clear previous content before appending new outlets
//            document.getElementById("pickUpOutlet").innerHTML = "";

//            // Loop through all the outlets
//            for (let i = 0; i < count; i++) {
//                var OutletName = parsedData.response.data[i]._identifier;
//                var OutletLocation = parsedData.response.data[i].locationAddress$_identifier;
//                var OutletPhone = parsedData.response.data[i].phone;
//                var OutletAdd1 = parsedData.response.data[i].addressLine1;
//                var OutletAdd2 = parsedData.response.data[i].addressLine2;
//                var OutletPostal = parsedData.response.data[i].postalCode;
//                var OutletWhatsApp = parsedData.response.data[i].whatsapp;
//                var OutletOpsHrs = parsedData.response.data[i].operatingHours;
//                var OutletMrt = parsedData.response.data[i].remarks;

//                // Prepare address for Google Maps
//                let fullDestination = `${OutletAdd1}, ${OutletAdd2}, ${OutletPostal}`;
//                const encodedDestination = encodeURIComponent(fullDestination);

//                // Dynamically create radio button and outlet details
//                document.getElementById("pickUpOutlet").innerHTML += `
//                              <label class="delivery_save_trigger option-box card-toggle media">
//                                  <input type="radio" name="checkout[delivery_method]" data-title="${OutletName}"
//                                          data-help-url="" data-pickup-url="" value="${OutletAdd1}, ${OutletAdd2}, ${OutletPostal} Singapore"
//                                         id="pickups-easystore-pickup-${i}">
//                                  <label for="pickups-easystore-pickup-${i}" class="media-control">
//                                      <b class="name">
//                                          <i class="fas fa-map-marker-alt text-danger"></i> ${OutletName}
//                                      </b>
//                                      <div class="address">
//                                          ${OutletAdd1}, ${OutletAdd2}, ${OutletPostal} Singapore
//                                      </div>
//                                  </label>
//                              </label>`;
//            }

//            // Attach event listener after the outlets are loaded
//            attachEventListeners();
//        },
//        error: function (xhr, status, error) {
//            console.error("Error fetching data:", error);
//        }
//    });
//}




//const radioButtons = document.querySelectorAll('input[type="radio"][name="checkout[delivery_method]"]');
//const shippingOptions = document.querySelectorAll('input[name="base_delivery_method"][value="shipping"]');
//const pickupSection = document.getElementById('pickup-section');
//const pickup_address = document.getElementById('pickup_address');
//const location_details = document.getElementById('location_details_wrapper');
//const deliveryMethod = document.getElementById('delivery_method');
//const pickup_datepicker = document.getElementById('pickup_datepicker');
//const receiver_section = document.getElementById('receiver_section');
//const pickupTitle = document.getElementById("pickup_title");
//const pickupAddress = document.getElementById("pickAddress");
//const alertInfo = document.querySelector('.alert.alert-info.mt-3');
//const shipping_warpper = document.getElementById('shipping-address-section');
//const shipping_methods = document.getElementById('shipping_methods');
//const billing_radio = document.getElementById('billing-address-radio');
//const billing_form = document.getElementById('billing-address-form-wrapper');
//const shippingDesc = document.getElementById('shippingDesc');
//const shippingPrice = document.getElementById('shippingPrice');

//// Function to update the UI for delivery method
//function updateUIForDeliveryMethod(isPickup, pickupName, pickupAddressText) {
//    alertInfo.classList.add('skeleton-loading');
//    requestAnimationFrame(() => {
//        console.log("Updating UI for", isPickup ? "pickup" : "shipping");

//        // Show or hide pickup sections based on the delivery method
//        pickupSection.style.display = isPickup ? 'block' : 'none';
//        pickup_address.style.display = isPickup ? 'block' : 'none';
//        location_details.style.display = isPickup ? 'block' : 'none';
//        deliveryMethod.style.display = isPickup ? 'block' : 'none';
//        pickup_datepicker.style.display = isPickup ? 'block' : 'none';
//        receiver_section.style.display = isPickup ? 'block' : 'none';
//        shipping_warpper.style.display = isPickup ? 'none' : 'block';
//        shipping_methods.style.display = isPickup ? 'none' : 'block';
//        billing_radio.style.display = isPickup ? 'none' : 'block';
//        billing_form.style.display = isPickup ? 'block' : 'none';

//        // Update the UI with pickup location details
//        pickupTitle.innerText = pickupName || "Select a Pickup Location";
//        pickupAddress.innerText = pickupAddressText || "No address provided";
//        alertInfo.classList.remove('skeleton-loading');

//        // Conditionally load either collection or delivery time based on isPickup
//        if (isPickup) {
//            sessionStorage.setItem("Shipping", 0);
//            sessionStorage.setItem("deliveryCharges", 0);
//            sessionStorage.setItem("Tax", 0);
//            sessionStorage.setItem("liftCharges", 0);
//            shippingDesc.style.display = "block";
//            shippingPrice.style.display = "none";
//            checkout(); // Call your checkout function here
//            document.getElementById("applyVoucher").disabled = false;
//            loadCollectionTime();  // Assuming this function is defined elsewhere
//        } else {
//            shippingDesc.style.display = "none";
//            shippingPrice.style.display = "block";
//            checkout(); // Call your checkout function here

//            // Handle postal code input
//            document.getElementById('shipping-zip').addEventListener('input', function (event) {
//                let postalCode = event.target.value.trim();
//                if (/^\d{6}$/.test(postalCode)) {
//                    let lastTwoDigits = postalCode.slice(-2);
//                    console.log("Last Two Digits:", lastTwoDigits);
//                    calculateCharges(lastTwoDigits); // Assuming this function is defined elsewhere
//                } else {
//                    let price = 0;
//                    shippingPrice.textContent = `SGD$ ${price.toFixed(2)}`;
//                }
//            });
//        }
//    });
//}



//// Add event listeners to radio buttons
//radioButtons.forEach(button => {
//    button.addEventListener('change', () => {
//        const isPickup = button.value.includes('pickup');  // Assuming 'pickup' is part of the value
//        updateUIForDeliveryMethod(isPickup, button.dataset.title, button.value);
//    });
//});

//// Attach event listeners
//radioButtons.forEach(button => {
//    button.addEventListener('change', function (event) {
//        handleRadioChange(event, true); // true for pickup
//    });
//});

//shippingOptions.forEach(button => {
//    button.addEventListener('change', function (event) {
//        handleRadioChange(event, false); // false for shipping
//    });
//});
//function GetPickUpOutlets() {
//    $.ajax({
//        type: "GET",
//        dataType: "json",
//        url: "/SR/Outlets", // Change this to your actual API endpoint
//        success: function (data) {
//            const parsedData = data.data ? JSON.parse(data.data) : data;
//            console.log("Response:", parsedData);

//            var count = parsedData.response.data.length;

//            // Clear previous content before appending new outlets
//            document.getElementById("pickUpOutlet").innerHTML = "";

//            // Loop through all the outlets
//            for (let i = 0; i < count; i++) {
//                var OutletName = parsedData.response.data[i]._identifier;
//                var OutletLocation = parsedData.response.data[i].locationAddress$_identifier;
//                var OutletPhone = parsedData.response.data[i].phone;
//                var OutletAdd1 = parsedData.response.data[i].addressLine1;
//                var OutletAdd2 = parsedData.response.data[i].addressLine2;
//                var OutletPostal = parsedData.response.data[i].postalCode;
//                var OutletWhatsApp = parsedData.response.data[i].whatsapp;
//                var OutletOpsHrs = parsedData.response.data[i].operatingHours;
//                var OutletMrt = parsedData.response.data[i].remarks;

//                // Prepare address for Google Maps
//                let fullDestination = `${OutletAdd1}, ${OutletAdd2}, ${OutletPostal}`;
//                const encodedDestination = encodeURIComponent(fullDestination);

//                // Dynamically create radio button and outlet details
//                document.getElementById("pickUpOutlet").innerHTML += `
//                    <label class="delivery_save_trigger option-box card-toggle media">
//                        <input type="radio" name="checkout[delivery_method]" data-title="${OutletName}"
//                               data-help-url="" data-pickup-url="" value="easystore-pickup-${i}"
//                               id="pickups-easystore-pickup-${i}">
//                        <label for="pickups-easystore-pickup-${i}" class="media-control">
//                            <b class="name">
//                                <i class="fas fa-map-marker-alt text-danger"></i> ${OutletName}
//                            </b>
//                            <div class="address">
//                                ${OutletAdd1}, ${OutletAdd2}, ${OutletPostal} Singapore
//                            </div>
//                        </label>
//                    </label>`;
//            }
//        },
//        error: function (xhr, status, error) {
//            console.error("Error fetching data:", error);
//        }
//    });
//}



//document.querySelector('.apply-voucher').addEventListener('click', applyVoucherDiscount);




// Function to show cart notification
//function showCartNotification(cartItem) {
//    let Count = JSON.parse(localStorage.getItem("cart")) || [];
//    const cartNotification = document.getElementById("cart-notification");
//    const cartNotificationProduct = document.getElementById("cart-notification-product");
//    const cartCountElement = document.getElementsByClassName("js-content-cart-count")[0];
//    const count = sessionStorage.getItem("cartCount");

//    console.log("Cart Count", count);

//    // Clear previous content
//    cartNotificationProduct.innerHTML = '';

//    // ✅ Build icing line only if charges exist
//    let icingLine = "";
//    const icingCharge = parseFloat(cartItem.IcingCharges); // convert safely
//    if (!isNaN(icingCharge) && icingCharge > 0) {
//        icingLine = `<p class="cart-notification-icing">Icing Picture: +$${icingCharge.toFixed(2)}</p>`;
//    }
//    // Update the notification content
//    cartNotificationProduct.innerHTML = `
//        <div class="cart-notification-item">
//            <img src="${cartItem.imgSrc}" alt="${cartItem.packageName}" class="cart-notification-item__image" style="width:30%" />
//            <div class="cart-notification-item__details">
//                <p class="cart-notification-item__name">
//                  ${cartItem.packageName}${cartItem.packageType ? ` (${cartItem.packageType})` : ''} + $${cartItem.itemPrice}
//                </p>
//                ${icingLine}
//                <p class="cart-notification-item__price">$${cartItem.total}</p>
//            </div>
//        </div>

//        <a href="/SecretRecipe/Cart" id="cart-notification-button" class="button button--secondary button--full-width">
//            View cart (<span class="js-content-cart-count">${Count.length}</span>)
//        </a>

//        <input type="hidden" name="_token" value="">
//        <input type="hidden" name="current_currency" value="SGD">

//        <a href="/SecretRecipe/Checkout" style="margin:5px;">
//            <button type="button" class="button button--primary button--full-width" style="text-decoration:none;">
//                Checkout
//            </button>
//        </a>

//        <button type="button" class="link button-label" style="margin:5px;" onclick="document.getElementById('cart-notification').style.display='none';">
//            Continue shopping
//        </button>

//    `;

//    // Update cart count
//    cartCountElement.textContent = parseInt(cartCountElement.textContent) + cartItem.quantity;

//    // Show the cart notification with animation
//    cartNotification.style.display = "block";
//    cartNotification.classList.add('active');
//    cartCount();
//}




//function GetAllMenupakage() {
//    cartCount();

//    const mainproductgrid = document.getElementById("main-collection-product-grid");
//    const menuPackageid = '';
//    // Clear previous content
//    mainproductgrid.innerHTML = '';

//    $.ajax({
//        type: "GET",
//        dataType: "json",
//        url: `/SR/GetAllMenuPackageSession`,
//        success: function (data) {
//            try {
//                const responseData = data.data ? JSON.parse(data.data) : data;



//                console.log(data.response.data)
//                if (!responseData || responseData.length === 0) {
//                    mainproductgrid.innerHTML = '<div class="error-message">No menu items found.</div>';
//                    return;
//                }

//                // Construct the carousel structure
//                //let carouselHTML = `
//                //    <button class="carousel-btn prev-btn">‹</button>
//                //    <div class="carousel-items">
//                //`;

//                responseData.forEach((itemData) => {
//                    if (!itemData) return; // Skip invalid items

//                    const {
//                        menuCatgImage: menuImg,
//                        menuPackage$_identifier: itemName = "No Description",
//                        amount: itemPrice,
//                        menuPackage: menuPackageid

//                    } = itemData;
//                    // Generate the product card
//                    //carouselHTML += `
//                    //    <div class="product-card">
//                    //        <div class="card card--product card--outline grid-link__image--product" tabindex="-1">
//                    //            <div class="card-wrapper">
//                    //                <a onclick="sessionStorage.setItem('menuPackage','${menuPackageid}')" href="/SecretRecipe/Product/${menuPackageid}" class="full-unstyled-link">
//                    //                    <div class="card card--product card--outline grid-link__image--product" tabindex="-1">
//                    //                        <div class="card__inner">
//                    //                            <div class="media media--transparent media--square media--hover-effect">
//                    //                                <img src="data:image/png;base64,${menuImg}" alt="" loading="lazy">

//                    //                                <img src="data:image/png;base64,${menuImg}" alt="" loading="lazy">

//                    //                            </div>

//                    //                        </div>
//                    //                        <span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-ribbon prodlabelv2-top_right" style="background-color:rgb(237, 27, 37);color:rgb(255, 255, 255);font-size:15px;color:rgb(237, 27, 37);"><span class="prodlabelv2-badge-text" style="background-color:rgb(237, 27, 37);color:rgb(255, 255, 255);font-size:15px;">NEW</span></span>
//                    //                    </div>

//                    //                    <div class="card-information">
//                    //                        <div class="card-information__wrapper">

//                    //                            <span class="card-information__text h5">
//                    //                                ${itemName}
//                    //                            </span>

//                    //                            <span class="caption-large light"></span>


//                    //                            <div class="price">

//                    //                                <dl>
//                    //                                    <div class="price__regular">
//                    //                                        <dt>
//                    //                                            <span class="visually-hidden visually-hidden--inline">Regular price</span>
//                    //                                        </dt>
//                    //                                        <dd>
//                    //                                            <span class="price-item price-item--regular">


//                    //                                                <span class="money" data-ori-price="">SGD$${itemPrice.toFixed(2)} </span>


//                    //                                            </span>
//                    //                                        </dd>
//                    //                                    </div>
//                    //                                    <div class="price__sale">
//                    //                                        <dt class="price__compare">
//                    //                                            <span class="visually-hidden visually-hidden--inline">Regular price</span>
//                    //                                        </dt>
//                    //                                        <dd class="price__compare">
//                    //                                            <s class="price-item price-item--regular">

//                    //                                                <span class="money" data-ori-price="62.90">SGD$ 62.90 </span>


//                    //                                            </s>
//                    //                                        </dd>
//                    //                                        <dt>
//                    //                                            <span class="visually-hidden visually-hidden--inline">Sale price</span>
//                    //                                        </dt>
//                    //                                        <dd>
//                    //                                            <span class="price-item price-item--sale">


//                    //                                                <span class="money" data-ori-price="62.90">SGD$ 62.90 </span>


//                    //                                            </span>
//                    //                                        </dd>
//                    //                                    </div>
//                    //                                </dl>

//                    //                            </div>

//                    //                        </div>

//                    //                    </div>
//                    //                </a>
//                    //            </div>
//                    //            <span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-ribbon prodlabelv2-top_right" style="background-color:rgb(237, 27, 37);color:rgb(255, 255, 255);font-size:15px;color:rgb(237, 27, 37);"><span class="prodlabelv2-badge-text" style="background-color:rgb(237, 27, 37);color:rgb(255, 255, 255);font-size:15px;">NEW</span></span>
//                    //        </div>
//                    //    </div>`;

//                    mainproductgrid.innerHTML += `
//                        <li class="grid__item">
//                            <div class="card-wrapper">
//                                <a href="/SecretRecipe/Product/${menuPackageid}" onclick="sessionStorage.setItem('menuPackage','${menuPackageid}')" class="full-unstyled-link">
//                                    <div class="card card--product card--outline grid-link__image--product" tabindex="-1">
//                                        <div class="card__inner">
//                                            <div class="media media--transparent media--square media--hover-effect">
//                                                    <img src="data:image/png;base64,${menuImg}" alt="${itemName}" loading="lazy">
//                                                    <img src="data:image/png;base64,${menuImg}" alt="${itemName}" loading="lazy">
//                                            </div>
//                                                <span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-ribbon prodlabelv2-top_right" style="background-color:rgb(237, 27, 37);color:rgb(237, 27, 37);font-size:15px;">
//                                                <span class="prodlabelv2-badge-text" style="background-color:rgb(237, 27, 37);color:rgb(255, 255, 255);font-size:15px;">NEW</span>
//                                            </span>
//                                        </div>
//                                        <div class="card-information">
//                                            <div class="card-information__wrapper">
//                                                <span class="card-information__text h5">${itemName}</span>
//                                                <span class="caption-large light"></span>
//                                                <div class="price">
//                                                    <dl>
//                                                        <div class="price__regular">
//                                                            <dt>
//                                                                <span class="visually-hidden visually-hidden--inline">Regular price</span>
//                                                            </dt>
//                                                            <dd>
//                                                                <span class="price-item price-item--regular">
//                                                                    <span class="money" data-ori-price="62.90">SGD$${itemPrice.toFixed(2)}</span>
//                                                                </span>
//                                                            </dd>
//                                                        </div>
//                                                        <div class="price__sale">
//                                                            <dt class="price__compare">
//                                                                <span class="visually-hidden visually-hidden--inline">Regular price</span>
//                                                            </dt>
//                                                            <dd class="price__compare">
//                                                                <s class="price-item price-item--regular">
//                                                                    <span class="money" data-ori-price="62.90">SGD$ ${itemPrice.toFixed(2)}</span>
//                                                                </s>
//                                                            </dd>
//                                                            <dt>
//                                                                <span class="visually-hidden visually-hidden--inline">Sale price</span>
//                                                            </dt>
//                                                            <dd>
//                                                                <span class="price-item price-item--sale">
//                                                                    <span class="money" data-ori-price="62.90">SGD$ ${itemPrice.toFixed(2)}</span>
//                                                                </span>
//                                                            </dd>
//                                                        </div>
//                                                    </dl>
//                                                </div>
//                                            </div>
//                                        </div>
//                                    </a>
//                                </div>
//                            </li>
//                    `;
//                });

//                // Close the carousel structure and add the next button
//                //carouselHTML += `
//                //    </div>
//                //    <button class="carousel-btn next-btn">›</button>
//                //`;

//                // Add the carousel HTML to the container
//                mainproductgrid.innerHTML = carouselHTML;

//            } catch (error) {
//                console.error("Error processing menu data:", error);
//                mainproductgrid.innerHTML = '<div class="error-message">Error processing menu data.</div>';
//            }

//        },
//        error: function (xhr, status, error) {
//            console.error("AJAX Error:", { xhr, status, error });
//            mainproductgrid.innerHTML = '<div class="error-message">Error loading menu data.</div>';
//        }
//    });
//}

//function addToCart1(event, menuPackage, type, qty, menuName, unitPrice, img64, UOM, menuCtg) {
//    // Prevent page refresh if it's a form submission or button click event
//    if (event) {
//        event.preventDefault();
//    }
//    window.scrollTo(0, 0);

//    let quantity = parseInt(qty);
//    let total = parseFloat(quantity * unitPrice).toFixed(2);
//    console.log(menuPackage, type, quantity, total, menuName, img64);

//    let count = parseInt(sessionStorage.getItem("cartCount")) || 0;

//    if (menuPackage !== '' && type !== '' && quantity) {
//        count++;
//        // Remove 'hidden' class from cart count bubble
//        let cartCountBubbles = document.getElementsByClassName("cart-count-bubble");
//        for (let i = 0; i < cartCountBubbles.length; i++) {
//            cartCountBubbles[i].classList.remove('hidden');
//        }
//        // Update the cart count in the UI
//        let cartCountElement = document.getElementsByClassName("js-content-cart-count")[0];
//        if (cartCountElement) {
//            cartCountElement.innerText = count;  // Update the text to show the new cart count
//        }
//        sessionStorage.setItem("cartCount", count);
//    }

//    // Create the cart item
//    const cartItem = {
//        menuPackage: menuPackage,
//        packageName: menuName,
//        packageType: type,
//        itemPrice: unitPrice,
//        quantity: quantity,
//        total: total,
//        imgSrc: img64,
//        itemUOM: UOM,
//        menuCtg: menuCtg,
//        productId: sessionStorage.getItem("productId")
//    };

//    // Update cart in localStorage
//    let cart = JSON.parse(localStorage.getItem("cart")) || [];
//    cart.push(cartItem);  // Push the new cart item
//    localStorage.setItem("cart", JSON.stringify(cart));

//    console.log("cartItem", cartItem);
//    cartCount();
//    showCartNotification(cartItem);

//    var element = document.getElementsByClassName("sf_promo-container")[0];
//    if (element) {
//        window.scrollBy(0, -2 * window.innerHeight / 3);
//        element.style.display = "none";
//    } else {
//        console.log("Element not found.");
//    }

//    // Show the cart notification
//}

//function renderProducts(products, mainProductGrid, loader) {
//    const newContent = products
//        .filter(item => {
//            // ✅ Skip cooler bag (match by packageName or category)
//            return item?.packageName?.toLowerCase() !== "cooler bag"
//                && item?.productCategory$_identifier !== "SR Packaging";
//        })
//        .map(item => {
//            if (!item) return '';

//            const {
//                packageName: itemName = "No Description",
//                amount,
//                menuPackage: menuPackageId,
//                image,
//                image02,
//                newItem = false,
//                bestseller = false,
//                available = true
//            } = item;

//            const itemPrice = parseFloat(amount) || 0;
//            const defaultImg = image ? getImageUrl(image) : '/images/default.png';
//            const hoverImg = image02 ? getImageUrl(image02) : defaultImg;

//            let badgeHTML = '';
//            if (!available) {
//                badgeHTML = `<span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                                  style="position:absolute;top:0.55rem;right:0.4rem;background-color:gray;color:white;font-size:10px;font-weight:bold;padding:0.65rem 0.75rem;border-radius:50px;z-index:2;display:inline-block;min-width:90px;text-align:center;">OUT OF STOCK</span>`;
//            } else if (newItem) {
//                badgeHTML = `<span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                                  style="position:absolute;top:0.55rem;right:0.4rem;background-color:rgb(237,27,37);color:white;font-size:10px;font-weight:bold;padding:0.65rem 0.75rem;border-radius:50px;z-index:2;display:inline-block;min-width:90px;text-align:center;">NEW</span>`;
//            } else if (bestseller) {
//                badgeHTML = `<span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                                  style="position:absolute;top:0.55rem;right:0.4rem;background-color:rgb(245,111,0);color:white;font-size:10px;font-weight:bold;padding:0.65rem 0.75rem;border-radius:50px;z-index:2;display:inline-block;min-width:90px;text-align:center;">Best Seller</span>`;
//            }

//            const greyClass = !available ? 'opacity-50 grayscale pointer-events-none' : '';
//            const priceClass = !available ? 'text-gray-400' : '';
//            const nameClass = !available ? 'text-gray-500' : '';

//            const wrapperStart = available
//                ? `<a href="/SecretRecipe/Product/${menuPackageId}?menuPackage=${menuPackageId}"
//                       onclick="sessionStorage.setItem('menuPackage','${menuPackageId}')"
//                       class="full-unstyled-link product-link1">`
//                : `<div class="product-link1">`;

//            const wrapperEnd = available ? `</a>` : `</div>`;

//            return `
//                <div class="product-card1 ${greyClass}">
//                    ${wrapperStart}
//                        <div class="product-image1 hover-image-wrapper">
//                            ${badgeHTML}
//                            <img class="default-img" src="${defaultImg}" alt="${itemName}" loading="lazy">
//                            <img class="hover-img" src="${hoverImg}" alt="${itemName}" loading="lazy">
//                        </div>
//                        <div class="product-info1">
//                            <h3 class="product-title1 ${nameClass}">${itemName}</h3>
//                            <p class="product-price1 ${priceClass}">SGD$ ${itemPrice.toFixed(2)}</p>
//                        </div>
//                    ${wrapperEnd}
//                </div>
//            `;
//        }).join('');

//    mainProductGrid.innerHTML = newContent;

//    // Tab UI logic
//    document.querySelectorAll('.tab-item').forEach(tab => {
//        tab.addEventListener('click', function () {
//            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('text-black', 'font-bold'));
//            this.classList.add('text-black', 'font-bold');
//            moveUnderline(this);
//        });
//    });

//    const defaultTab = Array.from(document.querySelectorAll('.tab-item'))
//        .find(tab => tab.textContent.trim().toUpperCase() === "ALL CAKES")
//        || document.querySelector('.tab-item');

//    if (defaultTab) {
//        defaultTab.classList.add('text-black', 'font-bold');
//        moveUnderline(defaultTab);
//    }

//    if (loader) loader.style.display = 'none';
//    mainProductGrid.classList.remove('loading');
//}


// ---- Backup 2025-08-14 -------------//
//function loadProductsForCategory() {
//    const mainProductGrid = document.getElementById('cakesMenu');
//    const loader = document.getElementById('loaderCakes');

//    if (loader) loader.style.display = 'block';
//    mainProductGrid.classList.add('loading');

//    $.ajax({
//        type: "GET",
//        dataType: "json",
//        cache: false,
//        url: "/SR/GetAllMenuPackageSession",
//        success: function (data) {
//            try {
//                let responseData = data?.response?.data;

//                if (typeof data.data === 'string') {
//                    const parsed = JSON.parse(data.data);
//                    responseData = parsed?.response?.data;
//                }

//                if (!Array.isArray(responseData) || responseData.length === 0) {
//                    mainProductGrid.innerHTML = '<div class="error-message">No menu items found.</div>';
//                    return;
//                }

//                const getImageUrl = id => `/SR/GetImageProxy?imageId=${encodeURIComponent(id)}`;

//                const newContent = responseData.map(item => {
//                    if (!item) return '';

//                    const {
//                        packageName: itemName = "No Description",
//                        amount,
//                        menuPackage: menuPackageId,
//                        image,
//                        image02,
//                        newItem = false,
//                        bestseller = false,
//                        available = true
//                    } = item;

//                    const itemPrice = parseFloat(amount) || 0;
//                    const defaultImg = image ? getImageUrl(image) : '/images/default.png';
//                    const hoverImg = image02 ? getImageUrl(image02) : defaultImg;

//                    let badgeHTML = '';

//                    if (!available) {
//                        badgeHTML = `
//                        <span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                              style="
//                                  position: absolute;
//                                  top: 0.55rem;
//                                  right: 0.4rem;
//                                  background-color: gray;
//                                  color: white;
//                                  font-size: 10px;
//                                  font-weight: bold;
//                                  padding: 0.65rem 0.75rem;
//                                  border-radius: 50px;
//                                  z-index: 2;
//                                  display: inline-block;
//                                  min-width: 90px;
//                                  text-align: center;">
//                            OUT OF STOCK
//                        </span>`;
//                   } else if (newItem) {
//                                        badgeHTML = `
//                        <span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                              style="
//                                  position: absolute;
//                                  top: 0.55rem;
//                                  right: 0.4rem;
//                                  background-color: rgb(237, 27, 37);
//                                  color: white;
//                                  font-size: 10px;
//                                  font-weight: bold;
//                                  padding: 0.65rem 0.75rem;
//                                  border-radius: 50px;
//                                  z-index: 2;
//                                  display: inline-block;
//                                  min-width: 90px;
//                                  text-align: center;">
//                            NEW
//                        </span>`;
//                    } else if (bestseller) {
//                                        badgeHTML = `
//                        <span class="prodlabelv2-badge prodlabelv2-position prodlabelv2-top_right"
//                              style="
//                                  position: absolute;
//                                  top: 0.55rem;
//                                  right: 0.4rem;
//                                  background-color: rgb(245, 111, 0);
//                                  color: white;
//                                  font-size: 10px;
//                                  font-weight: bold;
//                                  padding: 0.65rem 0.75rem;
//                                  border-radius: 50px;
//                                  z-index: 2;
//                                  display: inline-block;
//                                  min-width: 90px;
//                                  text-align: center;">
//                            Best Seller
//                        </span>`;
//                    }


//                    const greyClass = !available ? 'opacity-50 grayscale pointer-events-none' : '';
//                    const priceClass = !available ? 'text-gray-400' : '';
//                    const nameClass = !available ? 'text-gray-500' : '';

//                    // If available, wrap with <a>; else, use <div>
//                    const wrapperStart = available
//                        ? `<a href="/SecretRecipe/Product/${menuPackageId}?menuPackage=${menuPackageId}"
//                               onclick="sessionStorage.setItem('menuPackage','${menuPackageId}')"
//                               class="full-unstyled-link product-link1">`
//                        : `<div class="product-link1">`;

//                    const wrapperEnd = available ? `</a>` : `</div>`;

//                    return `
//                        <div class="product-card1 ${greyClass}">
//                            ${wrapperStart}
//                                <div class="product-image1 hover-image-wrapper">
//                                    ${badgeHTML}
//                                    <img class="default-img" src="${defaultImg}" alt="${itemName}" loading="lazy">
//                                    <img class="hover-img" src="${hoverImg}" alt="${itemName}" loading="lazy">
//                                </div>

//                                <div class="product-info1">
//                                    <h3 class="product-title1 ${nameClass}">${itemName}</h3>
//                                    <p class="product-price1 ${priceClass}">SGD$ ${itemPrice.toFixed(2)}</p>
//                                </div>
//                            ${wrapperEnd}
//                        </div>
//                    `;
//                }).join('');

//                mainProductGrid.innerHTML = newContent;

//                document.querySelectorAll('.tab-item').forEach(tab => {
//                    tab.addEventListener('click', function () {
//                        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('text-black', 'font-bold'));
//                        this.classList.add('text-black', 'font-bold');
//                        moveUnderline(this);
//                    });
//                });

//                const defaultTab = Array.from(document.querySelectorAll('.tab-item'))
//                    .find(tab => tab.textContent.trim().toUpperCase() === "ALL CAKES")
//                    || document.querySelector('.tab-item');

//                if (defaultTab) {
//                    defaultTab.classList.add('text-black', 'font-bold');
//                    moveUnderline(defaultTab);
//                }

//            } catch (error) {
//                console.error("Error handling menu data:", error);
//                mainProductGrid.innerHTML = '<div class="error-message">Error loading menu items.</div>';
//            } finally {
//                if (loader) loader.style.display = 'none';
//                mainProductGrid.classList.remove('loading');
//            }
//        },
//        error: function (xhr, status, err) {
//            console.error("AJAX error:", status, err);
//            mainProductGrid.innerHTML = '<div class="error-message">Failed to load menu items. Please try again later.</div>';
//            if (loader) loader.style.display = 'none';
//            mainProductGrid.classList.remove('loading');
//        }
//    });
//}

/*GetSessionFromPOS();*/
//loadGoogleAnalytics();
//isCheckoutPage = document.body.getAttribute("data-page") === "checkout";


//function loadGoogleAnalytics() {
//    if (window.gtag) return; // Prevent loading multiple times

//    // Load the gtag.js script
//    const scriptTag = document.createElement('script');
//    scriptTag.async = true;
//    scriptTag.src = 'https://www.googletagmanager.com/gtag/js?id=G-W28EPSFX9E';
//    document.head.appendChild(scriptTag);

//    // Initialize gtag
//    scriptTag.onload = function () {
//        window.dataLayer = window.dataLayer || [];
//        function gtag() { dataLayer.push(arguments); }
//        window.gtag = gtag;

//        gtag('js', new Date());
//        gtag('config', 'G-W28EPSFX9E');
//    };
//}


//// --- 2025-08-04 Back up ---
//    document.addEventListener('DOMContentLoaded', function () {
//        const dateInput = document.getElementById('appb9114bc45ab4c429_selected_date');
//        const container = document.getElementById('appb9114bc45ab4c429_datetimepicker');
//        const isUsingDatepicker = window.jQuery && $(dateInput).datepicker;
//        const deliveryCharges = parseFloat(sessionStorage.getItem("deliveryCharges"));
//        if (!dateInput || !container) {
//            return console.warn("Date input or container not found!");
//        }

//        const blockedDates = ["2025-07-05", "2025-07-08", "2025-07-10"]; // yyyy-mm-dd

//        function formatYMD(date) {
//            const y = date.getFullYear();
//            const m = String(date.getMonth() + 1).padStart(2, '0');
//            const d = String(date.getDate()).padStart(2, '0');
//            return `${y}-${m}-${d}`;
//        }

//        function formatToDisplay(date) {
//            const parsed = new Date(date);
//            if (isNaN(parsed)) return '';
//            const d = String(parsed.getDate()).padStart(2, '0');
//            const m = String(parsed.getMonth() + 1).padStart(2, '0');
//            const y = parsed.getFullYear();
//            return `${d}/${m}/${y}`;
//        }

//        function isBlocked(date) {
//            return blockedDates.includes(formatYMD(date));
//        }

//        const today = new Date();
//        const minSelectableDate = new Date(today);
//        minSelectableDate.setDate(today.getDate() + 4);

//        let lastFormattedDate = null;
//        let lastApiCallTime = 0;
//        const apiCallThrottle = 1000;

//        function handleDateChange() {
//            const rawValue = dateInput.value.trim();
//            let parsed = null;

//            if (rawValue.includes('/')) {
//                const [dd, mm, yyyy] = rawValue.split('/');
//                parsed = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
//            } else {
//                parsed = new Date(rawValue);
//            }

//            if (isNaN(parsed)) {
//                console.warn("Invalid date input:", rawValue);
//                return;
//            }

//            const formattedDate = formatYMD(parsed);
//            const displayDate = formatToDisplay(parsed);
//            if (!formattedDate) return;

//            dateInput.value = displayDate;

//            const now = Date.now();
//            if (formattedDate === lastFormattedDate || now - lastApiCallTime < apiCallThrottle) {
//                return;
//            }

//            lastFormattedDate = formattedDate;
//            lastApiCallTime = now;

//            callFreeDeliveryApi(formattedDate);
//        }

//        async function callFreeDeliveryApi(dateValue) {
//            try {
//                const apiUrl = `/SR/FreeAreaCharges?date=${encodeURIComponent(dateValue)}`;
//                console.log(`[API] Calling: ${apiUrl}`);

//                const response = await fetch(apiUrl, {
//                    method: 'GET',
//                    headers: { 'Accept': 'application/json' }
//                });

//                if (!response.ok) throw new Error(`Status ${response.status}`);

//                let data = await response.json();

//                if (typeof data === 'string') {
//                    try {
//                        data = JSON.parse(data);
//                    } catch (e) {
//                        console.error("JSON parse error:", data);
//                        updateDeliveryBanner({ error: 'Invalid JSON in response' });
//                        return;
//                    }
//                }

//                const deliveryInfo = data?.response?.data?.[0];

//                if (deliveryInfo && typeof deliveryInfo === 'object') {
//                    updateDeliveryBanner({
//                        isFreeDelivery: true,
//                        message: deliveryInfo.description,
//                        validUntil: deliveryInfo.deliveryDate?.split('T')[0] || ''
//                    });
//                    calculateFreeCharges();
//                    //console.log("deliveryCharges", sessionStorage.getItem("deliveryCharges"));

//                } else {
//                    const freeDelivery = sessionStorage.getItem("freeDeliveryPromo");
//                    const isFreeDeliveryNull = freeDelivery === null || freeDelivery === "null";
//                    const liftCharges = parseFloat(sessionStorage.getItem("liftCharges") || "0");
//                    const deliveryCharges = parseFloat(sessionStorage.getItem("deliveryCharges") || "0").toFixed(2);

//                    sessionStorage.setItem("freeDeliveryPromo", null);

//                    if (liftCharges != 0) {
//                        calLiftChargeFee2();
//                    }

//                    if (deliveryCharges != 0) {
//                        const shippingZip = document.getElementById('shipping-zip');
//                        if (shippingZip && shippingZip.value) {
//                            const postalCode = shippingZip.value.trim();
//                            if (/^\d{6}$/.test(postalCode)) {
//                                const lastTwoDigits = postalCode.slice(-2);
//                                //console.log("Last Two Digits:", lastTwoDigits);
//                                //calculateCharges(deliveryCharges);
//                            }
//                        }
//                    }

//                    updateDeliveryBanner({ isFreeDelivery: false });
//                }

//            } catch (error) {
//                console.error('API Error:', error);
//                updateDeliveryBanner({ error: 'Failed to check delivery status' });
//            }
//        }

//        function updateDeliveryBanner(apiResponse) {
//            let banner = document.getElementById('free-delivery-banner');

//            if (!banner) {
//                banner = document.createElement('div');
//                banner.id = 'free-delivery-banner';
//                banner.style.marginTop = '10px';
//                banner.style.padding = '10px';
//                banner.style.borderRadius = '4px';

//                container.parentNode.insertBefore(banner, container.nextSibling);
//            }

//            if (apiResponse.error) {
//                banner.innerHTML = `⚠️ ${apiResponse.error}`;
//                banner.style.backgroundColor = '#ffebee';
//                banner.style.color = '#c62828';
//                banner.style.display = 'block';
//                return;
//            }

//            const latestMessage = Array.isArray(apiResponse)
//                ? apiResponse.reduce((latest, current) =>
//                    new Date(current.date) > new Date(latest.date) ? current : latest
//                )
//                : apiResponse;

//            if (latestMessage.isFreeDelivery) {
//                banner.innerHTML = `
//                ✅ <strong>Free Delivery Available!</strong>
//                ${latestMessage.message ? `<p>${latestMessage.message}</p>` : ''}
//                ${latestMessage.date ? `<small>Valid until: ${latestMessage.date}</small>` : ''}
//            `;
//                banner.style.backgroundColor = '#e6ffed';
//                banner.style.color = '#1f6f3d';
//                banner.style.display = 'block';
//            } else {
//                banner.style.display = 'none';
//            }
//        }
//        handleDateChange();

//        // ✅ Initialize datepicker
//        if (isUsingDatepicker) {
//            $(dateInput).datepicker({
//                format: 'dd/mm/yyyy',
//                autoclose: true,
//                startDate: minSelectableDate,
//                beforeShowDay: function (date) {
//                    return isBlocked(date) ? false : true;
//                }
//            }).on('changeDate', function () {
//                handleDateChange();
//            });
//        } else {
//            ['change', 'input', 'blur'].forEach(evt => {
//                dateInput.addEventListener(evt, () => setTimeout(handleDateChange, 10));
//            });
//        }
//    });




//    function updateDeliveryBanner(apiResponse) {
//        let banner = document.getElementById('free-delivery-banner');

//        if (!banner) {
//            banner = document.createElement('div');
//            banner.id = 'free-delivery-banner';
//            banner.style.marginTop = '10px';
//            banner.style.padding = '10px';
//            banner.style.borderRadius = '4px';

//            container.parentNode.insertBefore(banner, container.nextSibling);
//        }

//        // If it's an error
//        if (apiResponse.error) {
//            banner.innerHTML = `⚠️ ${apiResponse.error}`;
//            banner.style.backgroundColor = '#ffebee';
//            banner.style.color = '#c62828';
//            banner.style.display = 'block';
//            return;
//        }

//        // If the API returns multiple messages, get the one with the latest date
//        let latestMessage;
//        if (Array.isArray(apiResponse)) {
//            latestMessage = apiResponse.reduce((latest, current) => {
//                return new Date(current.date) > new Date(latest.date) ? current : latest;
//            });
//        } else {
//            latestMessage = apiResponse;
//        }

//        if (latestMessage.isFreeDelivery) {
//            banner.innerHTML = `
//            ✅ <strong>Free Delivery Available!</strong>
//            ${latestMessage.message ? `<p>${latestMessage.message}</p>` : ''}
//            ${latestMessage.date ? `<small>Valid until: ${latestMessage.date}</small>` : ''}
//        `;
//            banner.style.backgroundColor = '#e6ffed';
//            banner.style.color = '#1f6f3d';
//            banner.style.display = 'block';
//        } else {
//            banner.style.display = 'none';
//        }
//    }


//    if (isUsingDatepicker) {
//        $(dateInput).datepicker({
//            format: 'dd/mm/yyyy',
//            autoclose: true
//        }).on('changeDate', function () {
//            handleDateChange();
//        });
//    } else {
//        ['change', 'input', 'blur'].forEach(evt => {
//            dateInput.addEventListener(evt, () => setTimeout(handleDateChange, 10));
//        });
//    }
//});


//function GetCustomerFavProduct() {
//    cartCount();
//    GetPromotion();

//    $.ajax({
//        type: "GET",
//        dataType: "json",
//        url: `/SR/GetMenuPackage`,
//        success: function (data) {
//            try {
//                const responseData = data.data ? JSON.parse(data.data) : data;
//                const bestSellers = responseData.response.data.filter(item => item.bestseller === true);

//                const allProducts = bestSellers.slice(0, 6);
//                const homeFav = document.getElementById("home_fav");
//                homeFav.innerHTML = "";

//                // Enhanced CSS styles
//                const styleTag = document.createElement("style");
//                styleTag.innerHTML = `
//                    /* Base Styles */
//                    .bestsellers-container {
//                        max-width: 1280px;
//                        margin: 0 auto;
//                        padding: 2rem 1.5rem;
//                        position: relative;
//                        font-family: 'Segoe UI', Roboto, sans-serif;
//                    }

//                    .bestsellers-title {
//                        text-align: center;
//                        margin-bottom: 0.75rem;
//                        letter-spacing: -0.5px;
//                        position: relative;
//                        display: inline-block;
//                        left: 50%;
//                        transform: translateX(-50%);
//                    }

//                    .bestsellers-title:after {
//                        content: '';
//                        position: absolute;
//                        bottom: -8px;
//                        left: 0;
//                        width: 100%;
//                        height: 3px;
//                        border-radius: 3px;
//                    }

//                    .bestsellers-subtitle {
//                        text-align: center;
//                        margin-bottom: 2.5rem;
//                        font-size: 1.4rem;
//                        line-height: 1.6;
//                        max-width: 700px;
//                        margin-left: auto;
//                        margin-right: auto;
//                        color : #636e72;
//                    }

//                    /* Carousel Container */
//                    .carousel-container {
//                        position: relative;
//                        overflow: hidden;
//                        margin-bottom: 2rem;
//                        padding: 0 2rem;
//                    }

//                    .carousel-slide {
//                        display: flex;
//                        transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
//                        will-change: transform;
//                    }

//                    .product-section {
//                        flex: 0 0 100%;
//                        box-sizing: border-box;
//                        padding: 0 1rem;
//                    }

//                    /* Products Grid */
//                    .products-container {
//                        display: grid;
//                        grid-template-columns: repeat(3, 1fr);
//                        gap: 1.5rem;
//                        margin: 6rem;
//                    }

//                    /* Product Card */
//                    .product {
//                        border-radius: 12px;
//                        background: white;
//                        text-align: center;
//                        transition: all 0.4s ease;
//                        box-shadow: 5px 5px 5px rgba(0,0,0,0.08);
//                        overflow: hidden;
//                        position: relative;
//                        display: flex;
//                        flex-direction: column;
//                        height: 100%;
//                    }

//                    .product:hover {
//                        transform: translateY(-8px);
//                        box-shadow: 0 15px 30px rgba(0,0,0,0.12);
//                    }

//                    .product-img-container {
//                        position: relative;
//                        overflow: hidden;
//                        height: 220px;
//                    }

//                    .product-img {
//                        width: 100%;
//                        height: 100%;
//                        object-fit: cover;
//                        transition: transform 0.5s ease;
//                    }

//                    .product:hover .product-img {
//                        transform: scale(1.05);
//                    }

//                    .product-content {
//                        padding: 1.5rem;
//                        flex-grow: 1;
//                        display: flex;
//                        flex-direction: column;
//                        background : #fff6e8;
//                    }

//                    .product-name {
//                            text-align: center;

//                        font-weight: 600;
//                        margin-bottom: 0.75rem;
//                        font-size: 1.5rem;
//                        color: #2d3436;
//                        line-height: 1.4;
//                        font-family: 'Playfair Display', serif;
//                        text-align: center;

//                    }

//                    .product-price {
//                        color: #e74c3c;
//                        margin-bottom: 1.25rem;
//                        font-weight: 700;
//                        font-size: 1.3rem;
//                        margin-top: auto;
//                    }

//                    .details-btn {
//                        color: white;
//                        border: none;
//                        padding: 0.75rem 1.5rem;
//                        border-radius: 50px;
//                        cursor: pointer;
//                        font-weight: 600;
//                        transition: all 0.3s ease;
//                        text-transform: uppercase;
//                        font-size: 14;
//                        letter-spacing: 0.5px;
//                        align-self: center;
//                        width: 100px;
//                        font-family: 'Segoe UI', Roboto, sans-serif;
//                    }

//                    .details-btn:hover {
//                        transform: translateY(-2px);
//                        box-shadow: 0 5px 15px rgba(231, 76, 60, 0.3);
//                        background-color: white;
//                        color: red;
//                    }

//                    /* Navigation Arrows */
//                    .carousel-nav {
//                        position: absolute;
//                        top: 50%;
//                        width: calc(100% - 4rem);
//                        left: 2rem;
//                        transform: translateY(-50%);
//                        display: flex;
//                        justify-content: space-between;
//                        pointer-events: none;
//                        z-index: 10;
//                    }

//                    .carousel-nav button {
//                        pointer-events: all;
//                        background: white;
//                        border: none;
//                        width: 48px;
//                        height: 48px;
//                        border-radius: 50%;
//                        display: flex;
//                        align-items: center;
//                        justify-content: center;
//                        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
//                        cursor: pointer;
//                        transition: all 0.3s ease;
//                    }

//                    .carousel-nav button:hover {
//                        transform: scale(1.1);
//                        background: #e74c3c;
//                    }

//                    .carousel-nav button:hover svg {
//                        stroke: white;
//                    }

//                    .carousel-nav button svg {
//                        width: 24px;
//                        height: 24px;
//                        stroke: #e74c3c;
//                        stroke-width: 2;
//                    }

//                    /* Desktop Slider Dots */
//                    .desktop-dots-container {
//                        display: flex;
//                        justify-content: center;
//                        gap: 10px;
//                        margin-top: 1.5rem;
//                        padding : 0.5rem;
//                    }

//                    .desktop-dot {
//                        width: 11px;
//                        height: 11px;
//                        border-radius: 50%;
//                        background-color: #dfe6e9;
//                        cursor: pointer;
//                        transition: all 0.3s ease;
//                    }

//                    .desktop-dot.active {
//                        background-color: #e74c3c;
//                        transform: scale(1.2);
//                    }

//                    /* Mobile Slider Dots Container 1 */
//                    .mobile-slider-dots-container1 {
//                        display: none;
//                        justify-content: center;
//                        gap: 10px;
//                        margin-top: 1.5rem;
//                    }

//                    .mobile-dot1 {
//                        width: 12px;
//                        height: 12px;
//                        border-radius: 50%;
//                        background-color: #dfe6e9;
//                        cursor: pointer;
//                        transition: all 0.3s ease;
//                    }

//                    .mobile-dot1.active {
//                        background-color: #e74c3c;
//                        transform: scale(1.2);
//                    }

//                    /* Badge for Special Items */
//                    .product-badge {
//                        position: absolute;
//                        top: 1rem;
//                        right: 1rem;
//                        background: #e74c3c;
//                        color: white;
//                        padding: 0.25rem 0.75rem;
//                        border-radius: 50px;
//                        font-size: 14px;
//                        font-weight: 700;
//                        z-index: 2;
//                    }

//                    /* Responsive Styles */
//                    @media (max-width: 1024px) {


//                        .product-img-container {
//                            height: 200px;
//                        }
//                    }

//                    @media (max-width: 768px) {
//                        .bestsellers-container {
//                            padding: 1.5rem 1rem;
//                        }

//                        .bestsellers-title {
//                            font-size: 1.8rem;
//                        }

//                        .carousel-container {
//                            padding: 0;
//                            display: none;
//                        }

//                        .products-container {
//                            grid-template-columns: repeat(2, 1fr);
//                            gap: 1rem;
//                        }

//                        .product-section {
//                            padding: 0 0;
//                        }

//                        .carousel-nav button {
//                            display: none;
//                        }

//                        .desktop-dots-container {
//                            display: none;
//                        }

//                        .mobile-slider-dots-container1 {
//                            display: flex;
//                                    padding: 2.5rem;
//                        }
//                    }

//                    @media (max-width: 480px) {
//                        .products-container {
//                            grid-template-columns: repeat(1, 1fr);
//                            gap: 1.25rem;
//                            margin: 0;
//                        }

//                        .product-img-container {
//                            height: 200px;
//                        }

//                        .product-content {
//                            padding: 1.25rem;
//                        }

//                        .bestsellers-title {
//                            font-size: 30px;
//                        }

//                        .bestsellers-subtitle {
//                            font-size: 1.4rem;
//                            margin-bottom: 2rem;
//                        }
//                    }

//                    /* Mobile-only Carousel */
//                    .mobile-carousel-container {
//                        display: none;
//                    }

//                    .mobile-carousel-slide {
//                        display: flex;
//                        transition: transform 0.6s ease;
//                        will-change: transform;
//                    }

//                    .mobile-product-slide {
//                        flex: 0 0 100%;
//                        box-sizing: border-box;
//                        padding: 5px 2rem;
//                    }
//                    @media (max-width: 768px) {
//                                .mobile-carousel-container {
//                            display: block;
//                            overflow: hidden;
//                            position: relative;
//                        }

//                        .slide-wrapper {
//                                flex: 0 0 100%;
//                                justify-content: center;
//                                padding: 1rem 10px;
//                                display:block;
//                                height : auto;
//                                width : auto;
//                            }

//                            .slide-item {
//                                flex: 0 0 100%;
//                                max-width: 100%;
//                                height : 450px;
//                                border-radius: 12px;
//                                background: white;
//                                text-align: center;
//                                transition: all 0.4s ease;
//                                box-shadow: 5px 5px 5px rgba(0, 0, 0, 0.08);
//                                overflow: hidden;
//                                position: relative;
//                                display: flex;
//                                flex-direction: column;
//                            }

//                            .slider-container {
//                            position: relative;
//                            overflow: hidden;
//                            margin: 2rem 0;
//                            border-radius: 12px;
//                            padding: 0 0.5rem;
//                            box-sizing: border-box;
//                        }
//                    }
//                `;
//                document.head.appendChild(styleTag);

//                // Create container
//                const container = document.createElement("div");
//                container.className = "bestsellers-container";
//                homeFav.appendChild(container);

//                // Title & subtitle
//                const title = document.createElement("h1");
//                title.className = "bestsellers-title";
//                title.textContent = "Our Bestsellers";
//                container.appendChild(title);

//                const subtitle = document.createElement("p");
//                subtitle.className = "bestsellers-subtitle";
//                subtitle.textContent = "Halal-certified cakes made with the finest ingredients, crafted with love for every celebration.";
//                container.appendChild(subtitle);

//                // Desktop Carousel
//                const carouselContainer = document.createElement("div");
//                carouselContainer.className = "carousel-container";
//                container.appendChild(carouselContainer);

//                const carouselSlide = document.createElement("div");
//                carouselSlide.className = "carousel-slide";
//                carouselContainer.appendChild(carouselSlide);

//                // Group products into sections
//                const productSections = [];
//                for (let i = 0; i < allProducts.length; i += 3) {
//                    productSections.push(allProducts.slice(i, i + 3));
//                }

//                // Create product sections
//                productSections.forEach((sectionProducts, sectionIndex) => {


//                    const section = document.createElement("div");
//                    section.className = "product-section";

//                    const productsContainer = document.createElement("div");
//                    productsContainer.className = "products-container";
//                    section.appendChild(productsContainer);

//                    sectionProducts.forEach((itemData, productIndex) => {
//                        const product = document.createElement("div");
//                        product.className = "product";

//                        if (itemData.bestseller === true) {
//                            const badge = document.createElement("span");
//                            badge.textContent = "Best Seller";
//                            badge.style.position = "absolute";
//                            badge.style.top = "0.55rem";
//                            badge.style.right = "0.20rem";
//                            badge.style.backgroundColor = "rgb(245, 111, 0)";
//                            badge.style.color = "white";
//                            badge.style.fontSize = "12px";
//                            badge.style.fontWeight = "bold";
//                            badge.style.padding = "0.25rem 0.75rem";
//                            badge.style.borderRadius = "9999px";
//                            badge.style.zIndex = "2";

//                            product.appendChild(badge);
//                        }


//                        const imgContainer = document.createElement("div");
//                        imgContainer.className = "product-img-container";

//                        const productImg = document.createElement("img");
//                        productImg.className = "product-img";
//                        productImg.alt = itemData.name || "Delicious Cake";
//                        productImg.loading = "lazy";
//                        // Use menuCatgImage or fallback to image
//                        const imageId = itemData.menuCatgImage || itemData.image;

//                        // Set the image source with fallback
//                        productImg.src = imageId
//                            ? getImageUrl(imageId)
//                            : "https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80";


//                        imgContainer.appendChild(productImg);
//                        product.appendChild(imgContainer);

//                        const productContent = document.createElement("div");
//                        productContent.className = "product-content";

//                        const productName = document.createElement("div");
//                        productName.className = "product-name";
//                        productName.textContent = itemData.packageName || "Special Cake";

//                        const productPrice = document.createElement("div");
//                        productPrice.className = "product-price";
//                        productPrice.textContent = `From SGD$ ${parseFloat(itemData.unitPrice || 0).toFixed(2)}`;

//                        const detailsBtn = document.createElement("button");
//                        detailsBtn.className = "details-btn";
//                        detailsBtn.textContent = "Details";
//                        detailsBtn.setAttribute("onclick", `sessionStorage.setItem('menuPackage','${itemData.id}');location.href='/SecretRecipe/Product/${itemData.id}';`);

//                        productContent.appendChild(productName);
//                        productContent.appendChild(productPrice);
//                        productContent.appendChild(detailsBtn);
//                        product.appendChild(productContent);

//                        productsContainer.appendChild(product);
//                    });

//                    carouselSlide.appendChild(section);
//                });

//                // Desktop navigation buttons
//                const navButtons = document.createElement("div");
//                navButtons.className = "carousel-nav";
//                carouselContainer.appendChild(navButtons);

//                const prevButton = document.createElement("button");
//                prevButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
//                prevButton.onclick = () => prevSlide();
//                prevButton.setAttribute("aria-label", "Previous slide");
//                navButtons.appendChild(prevButton);

//                const nextButton = document.createElement("button");
//                nextButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M9 18L15 12L9 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
//                nextButton.onclick = () => nextSlide();
//                nextButton.setAttribute("aria-label", "Next slide");
//                navButtons.appendChild(nextButton);

//                // Desktop slider dots
//                const desktopDotsContainer = document.createElement("div");
//                desktopDotsContainer.className = "desktop-dots-container";
//                carouselContainer.appendChild(desktopDotsContainer);

//                const desktopDots = [];
//                productSections.forEach((_, index) => {
//                    const dot = document.createElement("span");
//                    dot.className = "desktop-dot";
//                    if (index === 0) dot.classList.add("active");
//                    dot.onclick = () => goToSlide(index);
//                    desktopDotsContainer.appendChild(dot);
//                    desktopDots.push(dot);
//                });

//                // Mobile Carousel
//                const mobileCarouselContainer = document.createElement("div");
//                mobileCarouselContainer.className = "mobile-carousel-container";
//                container.appendChild(mobileCarouselContainer);

//                const mobileCarouselSlide = document.createElement("div");
//                mobileCarouselSlide.className = "mobile-carousel-slide";
//                mobileCarouselContainer.appendChild(mobileCarouselSlide);

//                // Create mobile slides
//                allProducts.forEach((itemData, index) => {
//                    const mobileSlide = document.createElement("div");
//                    mobileSlide.className = "mobile-product-slide";

//                    const product = document.createElement("div");
//                    product.className = "product";

//                    if (itemData.bestseller === true) {
//                        const badge = document.createElement("span");
//                        badge.textContent = "Best Seller";
//                        badge.style.position = "absolute";
//                        badge.style.top = "0.55rem";
//                        badge.style.right = "0.20rem";
//                        badge.style.backgroundColor = "rgb(245, 111, 0)";
//                        badge.style.color = "white";
//                        badge.style.fontSize = "12px";
//                        badge.style.fontWeight = "bold";
//                        badge.style.padding = "0.25rem 0.75rem";
//                        badge.style.borderRadius = "9999px";
//                        badge.style.zIndex = "2";

//                        product.appendChild(badge);
//                    }

//                    const imgContainer = document.createElement("div");
//                    imgContainer.className = "product-img-container";

//                    const productImg = document.createElement("img");
//                    productImg.className = "product-img";
//                    productImg.alt = itemData.name || "Delicious Cake";
//                    productImg.loading = "lazy";

//                    // Use menuCatgImage or fallback to image
//                    const imageId = itemData.menuCatgImage || itemData.image;

//                    // Set the image source with fallback
//                    productImg.src = imageId
//                        ? getImageUrl(imageId)
//                        : "https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80";


//                    imgContainer.appendChild(productImg);
//                    product.appendChild(imgContainer);

//                    const productContent = document.createElement("div");
//                    productContent.className = "product-content";

//                    const productName = document.createElement("div");
//                    productName.className = "product-name";
//                    productName.textContent = itemData.packageName || "Special Cake";

//                    const productPrice = document.createElement("div");
//                    productPrice.className = "product-price";
//                    productPrice.textContent = `From SGD$ ${parseFloat(itemData.unitPrice || 0).toFixed(2)}`;

//                    const detailsBtn = document.createElement("button");
//                    detailsBtn.className = "details-btn";
//                    detailsBtn.textContent = "Details";
//                    detailsBtn.setAttribute("onclick", `sessionStorage.setItem('menuPackage','${itemData.id}');location.href='/SecretRecipe/Product/${itemData.id}';`);


//                    productContent.appendChild(productName);
//                    productContent.appendChild(productPrice);
//                    productContent.appendChild(detailsBtn);
//                    product.appendChild(productContent);

//                    mobileSlide.appendChild(product);
//                    mobileCarouselSlide.appendChild(mobileSlide);
//                });

//                // Mobile slider dots container 1
//                const mobileSliderDots1 = document.createElement("div");
//                mobileSliderDots1.className = "mobile-slider-dots-container1";
//                container.appendChild(mobileSliderDots1);

//                const mobileDots1 = [];
//                allProducts.forEach((_, index) => {
//                    const dot = document.createElement("span");
//                    dot.className = "mobile-dot1";
//                    if (index === 0) dot.classList.add("active");
//                    dot.onclick = () => {
//                        mobileCurrentIndex = index;
//                        updateMobileCarousel();
//                    };
//                    mobileSliderDots1.appendChild(dot);
//                    mobileDots1.push(dot);
//                });

//                // Carousel control variables
//                let currentSlide = 0;
//                let mobileCurrentIndex = 0;
//                let slideInterval;

//                // Desktop carousel functions
//                function updateCarousel() {
//                    const offset = -currentSlide * 100;
//                    carouselSlide.style.transform = `translateX(${offset}%)`;
//                    desktopDots.forEach((dot, index) => {
//                        dot.classList.toggle("active", index === currentSlide);
//                    });
//                }

//                function goToSlide(index) {
//                    currentSlide = index;
//                    updateCarousel();
//                }

//                function nextSlide() {
//                    if (currentSlide < productSections.length - 1) {
//                        currentSlide++;
//                        updateCarousel();
//                    } else {
//                        // Already at last slide
//                        updateCarousel();

//                        // Auto-reset to first slide after short delay (e.g. 1.5s)
//                        setTimeout(() => {
//                            currentSlide = 0;
//                            updateCarousel();
//                        }, 1500); // Adjust delay as needed
//                    }
//                }


//                function prevSlide() {
//                    currentSlide = (currentSlide - 1 + productSections.length) % productSections.length;
//                    updateCarousel();
//                }

//                // Mobile carousel functions
//                function updateMobileCarousel() {
//                    const offset = -mobileCurrentIndex * 100;
//                    mobileCarouselSlide.style.transform = `translateX(${offset}%)`;
//                    mobileDots1.forEach((dot, index) => {
//                        dot.classList.toggle("active", index === mobileCurrentIndex);
//                    });
//                }

//                // Swipe handling for mobile
//                let mobileStartX = 0;
//                let mobileEndX = 0;

//                mobileCarouselContainer.addEventListener("touchstart", (e) => {
//                    mobileStartX = e.touches[0].clientX;
//                }, { passive: true });

//                mobileCarouselContainer.addEventListener("touchend", (e) => {
//                    mobileEndX = e.changedTouches[0].clientX;
//                    const delta = mobileEndX - mobileStartX;
//                    if (Math.abs(delta) > 50) {
//                        if (delta < 0) {
//                            mobileCurrentIndex = (mobileCurrentIndex + 1) % allProducts.length;
//                        } else {
//                            mobileCurrentIndex = (mobileCurrentIndex - 1 + allProducts.length) % allProducts.length;
//                        }
//                        updateMobileCarousel();
//                    }
//                }, { passive: true });

//                // Initialize carousels
//                updateCarousel();
//                updateMobileCarousel();

//                // Auto-advance slides
//                function startAutoSlide() {
//                    slideInterval = setInterval(nextSlide, 5000);
//                }

//                function pauseAutoSlide() {
//                    clearInterval(slideInterval);
//                }

//                /*startAutoSlide();*/

//                // Pause on hover
//                carouselContainer.addEventListener('mouseenter', pauseAutoSlide);
//                carouselContainer.addEventListener('mouseleave', startAutoSlide);

//                // Handle window resize
//                let resizeTimer;
//                window.addEventListener('resize', function () {
//                    clearTimeout(resizeTimer);
//                    pauseAutoSlide();
//                    resizeTimer = setTimeout(function () {
//                        updateCarousel();
//                        updateMobileCarousel();
//                        //startAutoSlide();
//                    }, 250);
//                });

//                // Touch support for desktop
//                let touchStartX = 0;
//                let touchEndX = 0;

//                carouselContainer.addEventListener('touchstart', (e) => {
//                    touchStartX = e.changedTouches[0].screenX;
//                    pauseAutoSlide();
//                }, { passive: true });

//                carouselContainer.addEventListener('touchend', (e) => {
//                    touchEndX = e.changedTouches[0].screenX;
//                    handleSwipe();
//                    startAutoSlide();
//                }, { passive: true });

//                function handleSwipe() {
//                    const threshold = 50;
//                    if (touchStartX - touchEndX > threshold) {
//                        nextSlide();
//                    } else if (touchEndX - touchStartX > threshold) {
//                        prevSlide();
//                    }
//                }

//            } catch (error) {
//                console.error("Error processing menu data:", error);
//            }
//        },
//        error: function (xhr, status, error) {
//            console.error("AJAX Request Failed:", { xhr, status, error });
//        }
//    });
//}
