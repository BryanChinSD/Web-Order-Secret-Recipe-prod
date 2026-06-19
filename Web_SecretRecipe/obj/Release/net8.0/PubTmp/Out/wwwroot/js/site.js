/*
    ------
    Events
    ------

    pages/viewed

    customers/signup

    customers/login

    products/searched

    collections/viewed

    products/viewed

    products/shared

    wishlists/item_added

    carts/items_added

    carts/viewed

    carts/item_removed

    checkouts/initiated

    checkouts/shipping_info_added

    checkouts/payment_info_added

    checkouts/completed

    orders/placed

    orders/purchased

    payments/captured

    payments/failed

  */



window.__latest_cart = window.__latest_cart || null;

_selector = document.querySelector.bind(document),
_selectorAll = document.querySelectorAll.bind(document)

document.addEventListener('DOMContentLoaded', (event) => {

    const default_currency = getCookie("currency")
    const customer_id = window.__st.cid
    const template = window.__st.p

    onPageView()

    //-----------------------//
    //        Configs        //
    //-----------------------//

    window.dataLayer = window.dataLayer || []

    Array.prototype.last = Array.prototype.last || function () {
        return this[this.length - 1] || null
    }

    Array.prototype.first = Array.prototype.first || function () {
        return this[0] || null
    }

    //----------------------//
    //       Triggers       //
    //----------------------//

    const XHR = window.XMLHttpRequest

    function xhr() {

        const xhr = new XHR()

        xhr.addEventListener("readystatechange", function () {

            if (xhr.readyState != 4) return

            try {

                const response_url = xhr.responseURL

                if (response_url.includes("cart/add")) {

                    window.__latest_cart = JSON.parse(xhr.response)

                    onCartItemsAdded() // ok

                }

                if (response_url.includes("cart/remove_item_quantity")) {

                    window.__latest_cart = JSON.parse(xhr.response)

                    onCartItemRemoved() // ok

                }

                if (response_url.includes("new_cart?retrieve=true")) {

                    result = JSON.parse(xhr.response)

                    if (result.cart) {
                        window.__latest_cart = result.cart
                    }

                }

            } catch (e) {

                console.error(e)

            }

        }, false);

        return xhr

    }

    window.XMLHttpRequest = xhr

    switch (template) {

        case 'cart': onCartView() // ok
            break
        case 'product': onProductView() // ok
            break
        case 'collection': onCollectionView() // ok
            break
        case 'blog': onBlogView()
            break
        case 'article': onArticleView()
            break
        case 'payment_completed': onOrderPlace()
            break
        case 'payment_fail': onPaymentFail()
            break

    }

    // _selector('form[action="/checkout/payments"]').addEventListener("submit", onPaymentInfoAdded(_selector('form[action="/checkout/payments"]')))
    if (_selector('form[action="/checkout/detail"]')) _selector('form[action="/checkout/detail"]').addEventListener("submit", () => { onShippingInfoAdded(_selector('form[action="/checkout/detail"]')) })  // ok
    if (_selector('form[action="/checkout/shipping"]')) _selector('form[action="/checkout/shipping"]').addEventListener("submit", () => { onShippingInfoAdded(_selector('form[action="/checkout/shipping"]')) })  // ok
    if (_selector('form[action="/account/register"]')) _selector('form[action="/account/register"]').addEventListener("submit", onSignUp)  // ok
    if (_selector('form[action="/account/login"]')) _selector('form[action="/account/login"]').addEventListener("submit", onLogin)  // ok
    if (_selector('form[action="/search"]')) _selector('form[action="/search"]').addEventListener("submit", onProductSearch()) // ok
    if (_selector('#line-login-btn')) _selector('#line-login-btn').addEventListener('click', onLineLogin) // ok
    if (_selector('#PlaceOrder')) _selector('#PlaceOrder').addEventListener("click", () => { onCheckoutComplete(_selector('form[action="/checkout/payments"]')) });  // ok
    if (_selector('#add_wishlist')) _selector('#add_wishlist').addEventListener("click", onWishlistItemAdded) // ok
    if (_selectorAll('a[href="/account/logout"]')) _selectorAll('a[href="/account/logout"]').forEach(logoutButton => logoutButton.addEventListener("click", onLogout)) // ok
    if (_selector('.CartDrawerTrigger.cart-page-link')) _selector('.CartDrawerTrigger.cart-page-link').addEventListener("click", onCartView) // ok
    if (_selector('.CartDrawerTrigger.cart-page-link.mobile-cart-page-link')) _selector('.CartDrawerTrigger.cart-page-link.mobile-cart-page-link').addEventListener("click", onCartView) // ok
    if (_selectorAll('a[class^="share-"]')) _selectorAll('a[class^="share-"]').forEach(shareButton => shareButton.addEventListener("click", () => { onProductShare(shareButton) })) // ok
    if (_selectorAll('[name$="checkout"]')) _selectorAll('[name$="checkout"]').forEach(checkoutButton => checkoutButton.addEventListener("click", onCheckoutInitiate))

    // For append elements
    const bodyMutationObserver = new MutationObserver(() => {
        if (_selector('#form__spc #PlaceOrder')) _selector('#form__spc #PlaceOrder').addEventListener("click", onSinglePageCheckout) // ok
        if (_selectorAll('[name$="checkout"]')) _selectorAll('[name$="checkout"]').forEach(checkoutButton => checkoutButton.addEventListener("click", onCheckoutInitiate))
    });
    bodyMutationObserver.observe(_selector("body"), { subtree: true, childList: true });

    //------------------------------//
    //        Event handlers        //
    //------------------------------//

    function onPageView() {

        EasyStore.Event.dispatch('pages/viewed', {
            page: {
                type: template,
                title: document.title,
                description: _selector('meta[name=description]') ? _selector('meta[name=description]').getAttribute('content') : null,
                url: location.href,
            }
        })

    }

    function onSignUp() {

        const email_regex = new RegExp(/^[a-zA-Z0-9.!#$%&"*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/)
        const phone_regex = new RegExp(/^(\+?6?01)[0-46-9]-*[0-9]{7,8}$/)

        const email_or_phone = _selector(`input[name="customer[email_or_phone]"]`).value.replace("+", "").replace(/\s+/, "")

        let data = {}

        if (email_regex.test(email_or_phone)) {
            data.method = 'email'
            data.email = email_or_phone
        }

        if (phone_regex.test(email_or_phone)) {
            data.method = "phone"
            data.phone = email_or_phone
        }

        if (!data.method) return

        EasyStore.Event.dispatch('customers/signup', data)

    }

    function onLogin() {

        const email_regex = new RegExp(/^[a-zA-Z0-9.!#$%&"*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/)
        const phone_regex = new RegExp(/^(\+?6?01)[0-46-9]-*[0-9]{7,8}$/)

        const email_or_phone = _selector(`input[name="customer[email_or_phone]"]`).value.replace("+", "").replace(/\s+/, "")

        let data = {}

        if (email_regex.test(email_or_phone)) {
            data.method = 'email'
            data.email = email_or_phone
        }

        if (phone_regex.test(email_or_phone)) {
            data.method = "phone"
            data.phone = email_or_phone
        }

        if (!data.method) return

        EasyStore.Event.dispatch('customers/login', data)

    }

    function onLineLogin() {

        EasyStore.Event.dispatch('customers/login', { method: 'line' })

    }

    function onLogout() {

        EasyStore.Event.dispatch('customers/logout', { customer_id })

    }

    function onBlogView() {

        const blog = ""

        EasyStore.Event.dispatch('blogs/viewed', { blog })

    }

    function onArticleView() {

        const article = ""

        EasyStore.Event.dispatch('articles/viewed', { article })

    }

    function onProductSearch() {

        const query = _selector('input[name=q]').value

        if (!query) return

        EasyStore.Event.dispatch('products/searched', { query })

    }

    function onCollectionView() {

        const collection = { "id": 119572, "handle": "feature-on-homepage", "name": "Featured Collection", "title": "Featured Collection", "url": "\/collections\/feature-on-homepage", "description": "", "content": "", "featured_image": { "src": null }, "products": [{ "id": 12800019, "handle": "xmas-bundle-1", "name": "Festive Bundle", "title": "Festive Bundle", "url": "\/products\/xmas-bundle-1", "price": 39.7, "price_min": "39.7", "price_max": "42.7", "price_varies": true, "compare_at_price": 0, "compare_at_price_min": "0.0", "compare_at_price_max": "0.0", "compare_at_price_varies": false, "available": true, "options_with_values": [{ "name": "Choice of X\u0027mas Pie", "position": 1, "values": ["Chicken Pie", "Beef Pie"] }, { "name": "Choice of Logcake", "position": 2, "values": ["Red Velvet", "Chocolate"] }], "options_by_name": { "Choice of X\u0027mas Pie": { "name": "Choice of X\u0027mas Pie", "position": 1, "values": ["Chicken Pie", "Beef Pie"] }, "Choice of Logcake": { "name": "Choice of Logcake", "position": 2, "values": ["Red Velvet", "Chocolate"] } }, "options": ["Choice of X\u0027mas Pie", "Choice of Logcake"], "has_only_default_variant": false, "sole_variant_id": null, "variants": [{ "id": 59111625, "title": "Chicken Pie, Red Velvet", "sku": "", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 78985133, "alt": "festive-bundle-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 3970, "compare_at_price": 0, "is_enabled": true, "options": ["Chicken Pie", " Red Velvet"], "option1": "Chicken Pie", "option2": " Red Velvet", "option3": null }, { "id": 59111626, "title": "Chicken Pie, Chocolate", "sku": "", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 3970, "compare_at_price": 0, "is_enabled": true, "options": ["Chicken Pie", " Chocolate"], "option1": "Chicken Pie", "option2": " Chocolate", "option3": null }, { "id": 59111627, "title": "Beef Pie, Red Velvet", "sku": "", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 4270, "compare_at_price": 0, "is_enabled": true, "options": ["Beef Pie", " Red Velvet"], "option1": "Beef Pie", "option2": " Red Velvet", "option3": null }, { "id": 59111628, "title": "Beef Pie, Chocolate", "sku": "", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 4270, "compare_at_price": 0, "is_enabled": true, "options": ["Beef Pie", " Chocolate"], "option1": "Beef Pie", "option2": " Chocolate", "option3": null }], "selected_variant": { "id": 59111625, "title": "Chicken Pie, Red Velvet", "sku": "", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 78985133, "alt": "festive-bundle-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 3970, "compare_at_price": 0, "is_enabled": true, "options": ["Chicken Pie", " Red Velvet"], "option1": "Chicken Pie", "option2": " Red Velvet", "option3": null }, "first_available_variant": { "id": 59111625, "title": "Chicken Pie, Red Velvet", "sku": "", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 78985133, "alt": "festive-bundle-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 3970, "compare_at_price": 0, "is_enabled": true, "options": ["Chicken Pie", " Red Velvet"], "option1": "Chicken Pie", "option2": " Red Velvet", "option3": null }, "selected_or_first_available_variant": { "id": 59111625, "title": "Chicken Pie, Red Velvet", "sku": "", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 78985133, "alt": "festive-bundle-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 3970, "compare_at_price": 0, "is_enabled": true, "options": ["Chicken Pie", " Red Velvet"], "option1": "Chicken Pie", "option2": " Red Velvet", "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "featured_image": { "id": 78985133, "alt": "festive-bundle-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "secondary_image": { "alt": "", "img_url": "", "src": "", "type": "" }, "images": [{ "id": 78985133, "alt": "festive-bundle-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }], "media": [{ "id": 78985133, "alt": "festive-bundle-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }], "featured_media": { "id": 78985133, "alt": "festive-bundle-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985133.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2024-11-14T15:00:00.000+08:00", "created_at": "2024-10-24T13:20:06.000+08:00", "is_wishlisted": null }, { "id": 12800039, "handle": "red-velvet-log-cake-1-1", "name": "Red Velvet Log Cake", "title": "Red Velvet Log Cake", "url": "\/products\/red-velvet-log-cake-1-1", "price": 22.8, "price_min": "22.8", "price_max": "22.8", "price_varies": false, "compare_at_price": 0, "compare_at_price_min": "0.0", "compare_at_price_max": "0.0", "compare_at_price_varies": false, "available": true, "options_with_values": [], "options_by_name": [], "options": ["Title"], "has_only_default_variant": true, "sole_variant_id": 59111705, "variants": [{ "id": 59111705, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 78985191, "alt": "red-velvet-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 2280, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }], "selected_variant": { "id": 59111705, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 78985191, "alt": "red-velvet-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 2280, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "first_available_variant": { "id": 59111705, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 78985191, "alt": "red-velvet-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 2280, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 59111705, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 78985191, "alt": "red-velvet-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 2280, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "featured_image": { "id": 78985191, "alt": "red-velvet-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "secondary_image": { "id": 78985190, "alt": "red-velvet-log-cut-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985190.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985190.png", "height": 1200, "width": 1200, "position": 2, "type": "Images" }, "images": [{ "id": 78985191, "alt": "red-velvet-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, { "id": 78985190, "alt": "red-velvet-log-cut-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985190.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985190.png", "height": 1200, "width": 1200, "position": 2, "type": "Images" }], "media": [{ "id": 78985191, "alt": "red-velvet-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, { "id": 78985190, "alt": "red-velvet-log-cut-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985190.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985190.png", "height": 1200, "width": 1200, "position": 2, "type": "Images" }], "featured_media": { "id": 78985191, "alt": "red-velvet-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985191.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2024-11-26T10:38:00.000+08:00", "created_at": "2024-10-24T13:25:21.000+08:00", "is_wishlisted": null }, { "id": 12799993, "handle": "red-velvet-log-cake-1", "name": "Chocolate Log Cake", "title": "Chocolate Log Cake", "url": "\/products\/red-velvet-log-cake-1", "price": 22.8, "price_min": "22.8", "price_max": "22.8", "price_varies": false, "compare_at_price": 0, "compare_at_price_min": "0.0", "compare_at_price_max": "0.0", "compare_at_price_varies": false, "available": true, "options_with_values": [], "options_by_name": [], "options": ["Title"], "has_only_default_variant": true, "sole_variant_id": 59111511, "variants": [{ "id": 59111511, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 78985164, "alt": "chocolate-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 2280, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }], "selected_variant": { "id": 59111511, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 78985164, "alt": "chocolate-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 2280, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "first_available_variant": { "id": 59111511, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 78985164, "alt": "chocolate-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 2280, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 59111511, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 78985164, "alt": "chocolate-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 2280, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "featured_image": { "id": 78985164, "alt": "chocolate-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "secondary_image": { "id": 78984832, "alt": "chocolate-log-cut-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78984832.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78984832.png", "height": 1200, "width": 1200, "position": 2, "type": "Images" }, "images": [{ "id": 78985164, "alt": "chocolate-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, { "id": 78984832, "alt": "chocolate-log-cut-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78984832.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78984832.png", "height": 1200, "width": 1200, "position": 2, "type": "Images" }], "media": [{ "id": 78985164, "alt": "chocolate-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, { "id": 78984832, "alt": "chocolate-log-cut-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78984832.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78984832.png", "height": 1200, "width": 1200, "position": 2, "type": "Images" }], "featured_media": { "id": 78985164, "alt": "chocolate-log-web", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985164.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2024-11-26T10:38:00.000+08:00", "created_at": "2024-10-24T13:12:20.000+08:00", "is_wishlisted": null }, { "id": 10854979, "handle": "christmas-pie-2022-1", "name": "X\u0027mas Pie", "title": "X\u0027mas Pie", "url": "\/products\/christmas-pie-2022-1", "price": 26.9, "price_min": "26.9", "price_max": "29.9", "price_varies": true, "compare_at_price": 0, "compare_at_price_min": "0.0", "compare_at_price_max": "0.0", "compare_at_price_varies": false, "available": true, "options_with_values": [{ "name": "Fillings", "position": 1, "values": ["Chicken", "Beef"] }], "options_by_name": { "Fillings": { "name": "Fillings", "position": 1, "values": ["Chicken", "Beef"] } }, "options": ["Fillings"], "has_only_default_variant": false, "sole_variant_id": null, "variants": [{ "id": 50076371, "title": "Chicken", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 78985254, "alt": "xmas-beef-pie-cut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 2690, "compare_at_price": 0, "is_enabled": true, "options": ["Chicken"], "option1": "Chicken", "option2": null, "option3": null }, { "id": 50076372, "title": "Beef", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": null, "price": 2990, "compare_at_price": 0, "is_enabled": true, "options": ["Beef"], "option1": "Beef", "option2": null, "option3": null }], "selected_variant": { "id": 50076371, "title": "Chicken", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 78985254, "alt": "xmas-beef-pie-cut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 2690, "compare_at_price": 0, "is_enabled": true, "options": ["Chicken"], "option1": "Chicken", "option2": null, "option3": null }, "first_available_variant": { "id": 50076371, "title": "Chicken", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 78985254, "alt": "xmas-beef-pie-cut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 2690, "compare_at_price": 0, "is_enabled": true, "options": ["Chicken"], "option1": "Chicken", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 50076371, "title": "Chicken", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 78985254, "alt": "xmas-beef-pie-cut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "price": 2690, "compare_at_price": 0, "is_enabled": true, "options": ["Chicken"], "option1": "Chicken", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "featured_image": { "id": 78985254, "alt": "xmas-beef-pie-cut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "secondary_image": { "id": 78985257, "alt": "xmas-chicken-pie-cut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985257.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985257.png", "height": 1200, "width": 1200, "position": 2, "type": "Images" }, "images": [{ "id": 78985254, "alt": "xmas-beef-pie-cut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, { "id": 78985257, "alt": "xmas-chicken-pie-cut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985257.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985257.png", "height": 1200, "width": 1200, "position": 2, "type": "Images" }], "media": [{ "id": 78985254, "alt": "xmas-beef-pie-cut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, { "id": 78985257, "alt": "xmas-chicken-pie-cut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985257.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985257.png", "height": 1200, "width": 1200, "position": 2, "type": "Images" }], "featured_media": { "id": 78985254, "alt": "xmas-beef-pie-cut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/78985254.png", "height": 1200, "width": 1200, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2024-11-14T15:00:00.000+08:00", "created_at": "2023-11-06T13:34:17.000+08:00", "is_wishlisted": null }, { "id": 10818742, "handle": "lotus-biscoff-cheese", "name": "Lotus Biscoff Cheese", "title": "Lotus Biscoff Cheese", "url": "\/products\/lotus-biscoff-cheese", "price": 62.9, "price_min": "62.9", "price_max": "62.9", "price_varies": false, "compare_at_price": 62.9, "compare_at_price_min": "62.9", "compare_at_price_max": "62.9", "compare_at_price_varies": false, "available": true, "options_with_values": [{ "name": "Size", "position": 1, "values": ["Regular"] }], "options_by_name": { "Size": { "name": "Size", "position": 1, "values": ["Regular"] } }, "options": ["Size"], "has_only_default_variant": false, "sole_variant_id": 49877742, "variants": [{ "id": 49877742, "title": "Regular", "sku": "Lotus Biscoff Cheese", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 954, "featured_image": { "id": 74887665, "alt": "Lotus Biscoff Cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }], "selected_variant": { "id": 49877742, "title": "Regular", "sku": "Lotus Biscoff Cheese", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 954, "featured_image": { "id": 74887665, "alt": "Lotus Biscoff Cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "first_available_variant": { "id": 49877742, "title": "Regular", "sku": "Lotus Biscoff Cheese", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 954, "featured_image": { "id": 74887665, "alt": "Lotus Biscoff Cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 49877742, "title": "Regular", "sku": "Lotus Biscoff Cheese", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 954, "featured_image": { "id": 74887665, "alt": "Lotus Biscoff Cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "featured_image": { "id": 74887665, "alt": "Lotus Biscoff Cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 64793530, "alt": "lotus-biscoff", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/64793530.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/64793530.jpeg", "height": 1000, "width": 1000, "position": 2, "type": "Images" }, "images": [{ "id": 74887665, "alt": "Lotus Biscoff Cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 64793530, "alt": "lotus-biscoff", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/64793530.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/64793530.jpeg", "height": 1000, "width": 1000, "position": 2, "type": "Images" }], "media": [{ "id": 74887665, "alt": "Lotus Biscoff Cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 64793530, "alt": "lotus-biscoff", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/64793530.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/64793530.jpeg", "height": 1000, "width": 1000, "position": 2, "type": "Images" }], "featured_media": { "id": 74887665, "alt": "Lotus Biscoff Cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887665.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": { "productlabel": { "type": "style", "value": "NEW", "style": "background-color:rgb(237, 27, 37);color:rgb(255, 255, 255);font-size:15px;", "class": "prodlabelv2-ribbon prodlabelv2-top_right" } }, "expires": null, "published_at": "2023-12-29T14:42:00.000+08:00", "created_at": "2023-10-31T12:24:31.000+08:00", "is_wishlisted": null }, { "id": 502068, "handle": "chocolate-indulgence", "name": "Chocolate Indulgence", "title": "Chocolate Indulgence", "url": "\/products\/chocolate-indulgence", "price": 38.9, "price_min": "38.9", "price_max": "398.0", "price_varies": true, "compare_at_price": 0, "compare_at_price_min": "0.0", "compare_at_price_max": "398.0", "compare_at_price_varies": true, "available": true, "options_with_values": [{ "name": "Size", "position": 1, "values": ["Regular", "Mini", "1R", "2R", "3R", "4R", "6R"] }], "options_by_name": { "Size": { "name": "Size", "position": 1, "values": ["Regular", "Mini", "1R", "2R", "3R", "4R", "6R"] } }, "options": ["Size"], "has_only_default_variant": false, "sole_variant_id": null, "variants": [{ "id": 16545715, "title": "Regular", "sku": "Chocolate Indulgence", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887768, "alt": "chocolate indulgence", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 5290, "compare_at_price": 5290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, { "id": 22161715, "title": "Mini", "sku": "Chocolate Indulgence", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 3890, "compare_at_price": 0, "is_enabled": true, "options": ["Mini"], "option1": "Mini", "option2": null, "option3": null }, { "id": 16545716, "title": "1R", "sku": "Chocolate Indulgence", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["1R"], "option1": "1R", "option2": null, "option3": null }, { "id": 16545717, "title": "2R", "sku": "Chocolate Indulgence", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 12800, "compare_at_price": 12800, "is_enabled": true, "options": ["2R"], "option1": "2R", "option2": null, "option3": null }, { "id": 16545718, "title": "3R", "sku": "Chocolate Indulgence", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 19800, "compare_at_price": 19800, "is_enabled": true, "options": ["3R"], "option1": "3R", "option2": null, "option3": null }, { "id": 16545719, "title": "4R", "sku": "Chocolate Indulgence", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 26800, "compare_at_price": 26800, "is_enabled": true, "options": ["4R"], "option1": "4R", "option2": null, "option3": null }, { "id": 16545720, "title": "6R", "sku": "Chocolate Indulgence", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 39800, "compare_at_price": 39800, "is_enabled": true, "options": ["6R"], "option1": "6R", "option2": null, "option3": null }], "selected_variant": { "id": 16545715, "title": "Regular", "sku": "Chocolate Indulgence", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887768, "alt": "chocolate indulgence", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 5290, "compare_at_price": 5290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "first_available_variant": { "id": 16545715, "title": "Regular", "sku": "Chocolate Indulgence", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887768, "alt": "chocolate indulgence", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 5290, "compare_at_price": 5290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 16545715, "title": "Regular", "sku": "Chocolate Indulgence", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887768, "alt": "chocolate indulgence", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 5290, "compare_at_price": 5290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "featured_image": { "id": 74887768, "alt": "chocolate indulgence", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 15986330, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15986330.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15986330.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }, "images": [{ "id": 74887768, "alt": "chocolate indulgence", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 15986330, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15986330.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15986330.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }], "media": [{ "id": 74887768, "alt": "chocolate indulgence", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 15986330, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15986330.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15986330.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }], "featured_media": { "id": 74887768, "alt": "chocolate indulgence", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887768.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": { "productlabel": { "type": "style", "value": "Best Seller", "style": "background-color:rgb(245, 111, 0);color:rgb(255, 255, 255);font-size:10px;", "class": "prodlabelv2-circle prodlabelv2-top_right" } }, "expires": null, "published_at": "2023-04-25T13:10:00.000+08:00", "created_at": "2012-10-31T23:06:59.000+08:00", "is_wishlisted": null }, { "id": 9029403, "handle": "milo-cheese", "name": "MILO Cheese", "title": "MILO Cheese", "url": "\/products\/milo-cheese", "price": 62.9, "price_min": "62.9", "price_max": "62.9", "price_varies": false, "compare_at_price": 62.9, "compare_at_price_min": "62.9", "compare_at_price_max": "62.9", "compare_at_price_varies": false, "available": false, "options_with_values": [{ "name": "Size", "position": 1, "values": ["Regular"] }], "options_by_name": { "Size": { "name": "Size", "position": 1, "values": ["Regular"] } }, "options": ["Size"], "has_only_default_variant": false, "sole_variant_id": 41010800, "variants": [{ "id": 41010800, "title": "Regular", "sku": "MILO Cheese", "taxable": true, "barcode": "", "available": false, "inventory_quantity": 0, "featured_image": { "id": 74887229, "alt": "milo cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }], "selected_variant": { "id": 41010800, "title": "Regular", "sku": "MILO Cheese", "taxable": true, "barcode": "", "available": false, "inventory_quantity": 0, "featured_image": { "id": 74887229, "alt": "milo cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "first_available_variant": null, "selected_or_first_available_variant": { "id": 41010800, "title": "Regular", "sku": "MILO Cheese", "taxable": true, "barcode": "", "available": false, "inventory_quantity": 0, "featured_image": { "id": 74887229, "alt": "milo cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "featured_image": { "id": 74887229, "alt": "milo cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 52336530, "alt": "MiloCheese KV", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/52336530.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/52336530.jpeg", "height": 2400, "width": 1606, "position": 2, "type": "Images" }, "images": [{ "id": 74887229, "alt": "milo cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 52336530, "alt": "MiloCheese KV", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/52336530.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/52336530.jpeg", "height": 2400, "width": 1606, "position": 2, "type": "Images" }], "media": [{ "id": 74887229, "alt": "milo cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 52336530, "alt": "MiloCheese KV", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/52336530.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/52336530.jpeg", "height": 2400, "width": 1606, "position": 2, "type": "Images" }], "featured_media": { "id": 74887229, "alt": "milo cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887229.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2024-09-29T13:38:29.000+08:00", "created_at": "2023-01-08T02:57:13.000+08:00", "is_wishlisted": null }, { "id": 502072, "handle": "marble-cheese", "name": "Marble Cheese", "title": "Marble Cheese", "url": "\/products\/marble-cheese", "price": 52.9, "price_min": "52.9", "price_max": "62.9", "price_varies": true, "compare_at_price": 52.9, "compare_at_price_min": "52.9", "compare_at_price_max": "62.9", "compare_at_price_varies": true, "available": true, "options_with_values": [{ "name": "Size", "position": 1, "values": ["Regular", "1R"] }], "options_by_name": { "Size": { "name": "Size", "position": 1, "values": ["Regular", "1R"] } }, "options": ["Size"], "has_only_default_variant": false, "sole_variant_id": null, "variants": [{ "id": 4371392, "title": "Regular", "sku": "Marble Cheese", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887425, "alt": "marble cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 5290, "compare_at_price": 5290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, { "id": 4371393, "title": "1R", "sku": "Marble Cheese", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["1R"], "option1": "1R", "option2": null, "option3": null }], "selected_variant": { "id": 4371392, "title": "Regular", "sku": "Marble Cheese", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887425, "alt": "marble cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 5290, "compare_at_price": 5290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "first_available_variant": { "id": 4371392, "title": "Regular", "sku": "Marble Cheese", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887425, "alt": "marble cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 5290, "compare_at_price": 5290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 4371392, "title": "Regular", "sku": "Marble Cheese", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887425, "alt": "marble cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 5290, "compare_at_price": 5290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "featured_image": { "id": 74887425, "alt": "marble cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 15991098, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15991098.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15991098.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }, "images": [{ "id": 74887425, "alt": "marble cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 15991098, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15991098.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15991098.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }], "media": [{ "id": 74887425, "alt": "marble cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 15991098, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15991098.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15991098.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }], "featured_media": { "id": 74887425, "alt": "marble cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887425.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": { "productlabel": { "type": "style", "value": "Best Seller", "style": "background-color:rgb(245, 111, 0);color:rgb(255, 255, 255);font-size:10px;", "class": "prodlabelv2-circle prodlabelv2-top_right" } }, "expires": null, "published_at": "2023-04-25T13:14:00.000+08:00", "created_at": "2012-10-31T23:45:56.000+08:00", "is_wishlisted": null }, { "id": 9029394, "handle": "decadent-tiramisu", "name": "Decadent Tiramisu", "title": "Decadent Tiramisu", "url": "\/products\/decadent-tiramisu", "price": 62.9, "price_min": "62.9", "price_max": "438.0", "price_varies": true, "compare_at_price": 62.9, "compare_at_price_min": "62.9", "compare_at_price_max": "438.0", "compare_at_price_varies": true, "available": true, "options_with_values": [{ "name": "Size", "position": 1, "values": ["Regular", "1R", "2R", "3R", "4R", "6R"] }], "options_by_name": { "Size": { "name": "Size", "position": 1, "values": ["Regular", "1R", "2R", "3R", "4R", "6R"] } }, "options": ["Size"], "has_only_default_variant": false, "sole_variant_id": null, "variants": [{ "id": 41010779, "title": "Regular", "sku": "Decadent Tiramisu", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887732, "alt": "Decadent Tiramisu", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, { "id": 41010781, "title": "1R", "sku": "Decadent Tiramisu", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 7290, "compare_at_price": 7290, "is_enabled": true, "options": ["1R"], "option1": "1R", "option2": null, "option3": null }, { "id": 41010782, "title": "2R", "sku": "Decadent Tiramisu", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 14800, "compare_at_price": 14800, "is_enabled": true, "options": ["2R"], "option1": "2R", "option2": null, "option3": null }, { "id": 41010783, "title": "3R", "sku": "Decadent Tiramisu", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 22800, "compare_at_price": 22800, "is_enabled": true, "options": ["3R"], "option1": "3R", "option2": null, "option3": null }, { "id": 41010784, "title": "4R", "sku": "Decadent Tiramisu", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 29800, "compare_at_price": 29800, "is_enabled": true, "options": ["4R"], "option1": "4R", "option2": null, "option3": null }, { "id": 41010785, "title": "6R", "sku": "Decadent Tiramisu", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 43800, "compare_at_price": 43800, "is_enabled": true, "options": ["6R"], "option1": "6R", "option2": null, "option3": null }], "selected_variant": { "id": 41010779, "title": "Regular", "sku": "Decadent Tiramisu", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887732, "alt": "Decadent Tiramisu", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "first_available_variant": { "id": 41010779, "title": "Regular", "sku": "Decadent Tiramisu", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887732, "alt": "Decadent Tiramisu", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 41010779, "title": "Regular", "sku": "Decadent Tiramisu", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887732, "alt": "Decadent Tiramisu", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "featured_image": { "id": 74887732, "alt": "Decadent Tiramisu", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 52336384, "alt": "Decadent Tiramisu (2)", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/52336384.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/52336384.jpeg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }, "images": [{ "id": 74887732, "alt": "Decadent Tiramisu", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 52336384, "alt": "Decadent Tiramisu (2)", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/52336384.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/52336384.jpeg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }], "media": [{ "id": 74887732, "alt": "Decadent Tiramisu", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 52336384, "alt": "Decadent Tiramisu (2)", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/52336384.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/52336384.jpeg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }], "featured_media": { "id": 74887732, "alt": "Decadent Tiramisu", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887732.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2023-04-25T13:02:00.000+08:00", "created_at": "2023-01-08T02:51:36.000+08:00", "is_wishlisted": null }, { "id": 6171069, "handle": "hokkaido-triple-chocolate-cheese", "name": "Hokkaido Triple Chocolate Cheese", "title": "Hokkaido Triple Chocolate Cheese", "url": "\/products\/hokkaido-triple-chocolate-cheese", "price": 62.9, "price_min": "62.9", "price_max": "62.9", "price_varies": false, "compare_at_price": 62.9, "compare_at_price_min": "62.9", "compare_at_price_max": "62.9", "compare_at_price_varies": false, "available": true, "options_with_values": [{ "name": "Size", "position": 1, "values": ["Regular", "1R"] }], "options_by_name": { "Size": { "name": "Size", "position": 1, "values": ["Regular", "1R"] } }, "options": ["Size"], "has_only_default_variant": false, "sole_variant_id": 27512552, "variants": [{ "id": 27512552, "title": "Regular", "sku": null, "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887268, "alt": "hokkaido triple chocolate cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }], "selected_variant": { "id": 27512552, "title": "Regular", "sku": null, "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887268, "alt": "hokkaido triple chocolate cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "first_available_variant": { "id": 27512552, "title": "Regular", "sku": null, "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887268, "alt": "hokkaido triple chocolate cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 27512552, "title": "Regular", "sku": null, "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74887268, "alt": "hokkaido triple chocolate cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "featured_image": { "id": 74887268, "alt": "hokkaido triple chocolate cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 34933289, "alt": "Hokkaido-Triple-Chocolate_Side.jpg", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933289.jpg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933289.jpg", "height": 1500, "width": 1000, "position": 2, "type": "Images" }, "images": [{ "id": 74887268, "alt": "hokkaido triple chocolate cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 34933289, "alt": "Hokkaido-Triple-Chocolate_Side.jpg", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933289.jpg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933289.jpg", "height": 1500, "width": 1000, "position": 2, "type": "Images" }], "media": [{ "id": 74887268, "alt": "hokkaido triple chocolate cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 34933289, "alt": "Hokkaido-Triple-Chocolate_Side.jpg", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933289.jpg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933289.jpg", "height": 1500, "width": 1000, "position": 2, "type": "Images" }], "featured_media": { "id": 74887268, "alt": "hokkaido triple chocolate cheese", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887268.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2023-04-25T13:03:00.000+08:00", "created_at": "2021-09-24T18:12:58.000+08:00", "is_wishlisted": null }, { "id": 502061, "handle": "black-forest", "name": "Signature Black Forest", "title": "Signature Black Forest", "url": "\/products\/black-forest", "price": 62.9, "price_min": "62.9", "price_max": "438.0", "price_varies": true, "compare_at_price": 62.9, "compare_at_price_min": "62.9", "compare_at_price_max": "438.0", "compare_at_price_varies": true, "available": true, "options_with_values": [{ "name": "type", "position": 1, "values": ["Regular", "1R", "2R", "3R", "4R", "6R"] }], "options_by_name": { "type": { "name": "type", "position": 1, "values": ["Regular", "1R", "2R", "3R", "4R", "6R"] } }, "options": ["type"], "has_only_default_variant": false, "sole_variant_id": null, "variants": [{ "id": 4371332, "title": "Regular", "sku": "Black Forest", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 996, "featured_image": { "id": 74887991, "alt": "premium black forest", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, { "id": 4371336, "title": "1R", "sku": "Black Forest", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 1000, "featured_image": null, "price": 7290, "compare_at_price": 7290, "is_enabled": true, "options": ["1R"], "option1": "1R", "option2": null, "option3": null }, { "id": 4371333, "title": "2R", "sku": "Black Forest", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 1000, "featured_image": null, "price": 14800, "compare_at_price": 14800, "is_enabled": true, "options": ["2R"], "option1": "2R", "option2": null, "option3": null }, { "id": 4371334, "title": "3R", "sku": "Black Forest", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 1000, "featured_image": null, "price": 22800, "compare_at_price": 22800, "is_enabled": true, "options": ["3R"], "option1": "3R", "option2": null, "option3": null }, { "id": 4371335, "title": "4R", "sku": "Black Forest", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 1000, "featured_image": null, "price": 29800, "compare_at_price": 29800, "is_enabled": true, "options": ["4R"], "option1": "4R", "option2": null, "option3": null }, { "id": 4371337, "title": "6R", "sku": "Black Forest", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 1000, "featured_image": null, "price": 43800, "compare_at_price": 43800, "is_enabled": true, "options": ["6R"], "option1": "6R", "option2": null, "option3": null }], "selected_variant": { "id": 4371332, "title": "Regular", "sku": "Black Forest", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 996, "featured_image": { "id": 74887991, "alt": "premium black forest", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "first_available_variant": { "id": 4371332, "title": "Regular", "sku": "Black Forest", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 996, "featured_image": { "id": 74887991, "alt": "premium black forest", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 4371332, "title": "Regular", "sku": "Black Forest", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 996, "featured_image": { "id": 74887991, "alt": "premium black forest", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "featured_image": { "id": 74887991, "alt": "premium black forest", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 16000667, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16000667.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16000667.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }, "images": [{ "id": 74887991, "alt": "premium black forest", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 16000667, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16000667.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16000667.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }], "media": [{ "id": 74887991, "alt": "premium black forest", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 16000667, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16000667.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16000667.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }], "featured_media": { "id": 74887991, "alt": "premium black forest", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887991.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2024-10-30T00:00:00.000+08:00", "created_at": "2012-10-31T22:40:32.000+08:00", "is_wishlisted": null }, { "id": 10860378, "handle": "onde-onde-1-1", "name": "Mini Confetti Rainbow", "title": "Mini Confetti Rainbow", "url": "\/products\/onde-onde-1-1", "price": 46.9, "price_min": "46.9", "price_max": "46.9", "price_varies": false, "compare_at_price": 0, "compare_at_price_min": "0.0", "compare_at_price_max": "0.0", "compare_at_price_varies": false, "available": true, "options_with_values": [], "options_by_name": [], "options": ["Title"], "has_only_default_variant": true, "sole_variant_id": 50102962, "variants": [{ "id": 50102962, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 53, "featured_image": { "id": 74888022, "alt": "rainbow confetti", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }], "selected_variant": { "id": 50102962, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 53, "featured_image": { "id": 74888022, "alt": "rainbow confetti", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "first_available_variant": { "id": 50102962, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 53, "featured_image": { "id": 74888022, "alt": "rainbow confetti", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 50102962, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 53, "featured_image": { "id": 74888022, "alt": "rainbow confetti", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "featured_image": { "id": 74888022, "alt": "rainbow confetti", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 65113632, "alt": "Confetti-Rainbow", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/65113632.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/65113632.jpeg", "height": 1500, "width": 1000, "position": 2, "type": "Images" }, "images": [{ "id": 74888022, "alt": "rainbow confetti", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 65113632, "alt": "Confetti-Rainbow", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/65113632.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/65113632.jpeg", "height": 1500, "width": 1000, "position": 2, "type": "Images" }], "media": [{ "id": 74888022, "alt": "rainbow confetti", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 65113632, "alt": "Confetti-Rainbow", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/65113632.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/65113632.jpeg", "height": 1500, "width": 1000, "position": 2, "type": "Images" }], "featured_media": { "id": 74888022, "alt": "rainbow confetti", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888022.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2023-11-07T19:15:00.000+08:00", "created_at": "2023-11-07T11:46:17.000+08:00", "is_wishlisted": null }, { "id": 9598568, "handle": "onde-onde", "name": "Mini Onde Onde", "title": "Mini Onde Onde", "url": "\/products\/onde-onde", "price": 46.9, "price_min": "46.9", "price_max": "46.9", "price_varies": false, "compare_at_price": 0, "compare_at_price_min": "0.0", "compare_at_price_max": "0.0", "compare_at_price_varies": false, "available": true, "options_with_values": [], "options_by_name": [], "options": ["Title"], "has_only_default_variant": true, "sole_variant_id": 43989142, "variants": [{ "id": 43989142, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 97, "featured_image": { "id": 74888068, "alt": "onde onde", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }], "selected_variant": { "id": 43989142, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 97, "featured_image": { "id": 74888068, "alt": "onde onde", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "first_available_variant": { "id": 43989142, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 97, "featured_image": { "id": 74888068, "alt": "onde onde", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 43989142, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 97, "featured_image": { "id": 74888068, "alt": "onde onde", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "featured_image": { "id": 74888068, "alt": "onde onde", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 56311034, "alt": "Platinum Collection - Onde Onde Cake Mood Shoot", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56311034.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56311034.jpeg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }, "images": [{ "id": 74888068, "alt": "onde onde", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 56311034, "alt": "Platinum Collection - Onde Onde Cake Mood Shoot", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56311034.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56311034.jpeg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }], "media": [{ "id": 74888068, "alt": "onde onde", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 56311034, "alt": "Platinum Collection - Onde Onde Cake Mood Shoot", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56311034.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56311034.jpeg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }], "featured_media": { "id": 74888068, "alt": "onde onde", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888068.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2024-08-07T09:21:00.000+08:00", "created_at": "2023-04-18T10:07:24.000+08:00", "is_wishlisted": null }, { "id": 9598546, "handle": "sweet-potato", "name": "Mini Sweet Potato", "title": "Mini Sweet Potato", "url": "\/products\/sweet-potato", "price": 46.9, "price_min": "46.9", "price_max": "46.9", "price_varies": false, "compare_at_price": 0, "compare_at_price_min": "0.0", "compare_at_price_max": "0.0", "compare_at_price_varies": false, "available": false, "options_with_values": [], "options_by_name": [], "options": ["Title"], "has_only_default_variant": true, "sole_variant_id": 43989058, "variants": [{ "id": 43989058, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": false, "inventory_quantity": 0, "featured_image": { "id": 74888078, "alt": "sweet potato", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }], "selected_variant": { "id": 43989058, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": false, "inventory_quantity": 0, "featured_image": { "id": 74888078, "alt": "sweet potato", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "first_available_variant": null, "selected_or_first_available_variant": { "id": 43989058, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": false, "inventory_quantity": 0, "featured_image": { "id": 74888078, "alt": "sweet potato", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "featured_image": { "id": 74888078, "alt": "sweet potato", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 56310943, "alt": "Platinum Collection - Sweet Potato Mood Shoot", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56310943.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56310943.jpeg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }, "images": [{ "id": 74888078, "alt": "sweet potato", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 56310943, "alt": "Platinum Collection - Sweet Potato Mood Shoot", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56310943.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56310943.jpeg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }], "media": [{ "id": 74888078, "alt": "sweet potato", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 56310943, "alt": "Platinum Collection - Sweet Potato Mood Shoot", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56310943.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56310943.jpeg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }], "featured_media": { "id": 74888078, "alt": "sweet potato", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888078.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2024-08-07T09:21:00.000+08:00", "created_at": "2023-04-18T10:01:49.000+08:00", "is_wishlisted": null }, { "id": 9598561, "handle": "red-velvet", "name": "Mini Red Velvet", "title": "Mini Red Velvet", "url": "\/products\/red-velvet", "price": 46.9, "price_min": "46.9", "price_max": "46.9", "price_varies": false, "compare_at_price": 0, "compare_at_price_min": "0.0", "compare_at_price_max": "0.0", "compare_at_price_varies": false, "available": true, "options_with_values": [], "options_by_name": [], "options": ["Title"], "has_only_default_variant": true, "sole_variant_id": 43989110, "variants": [{ "id": 43989110, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 74888074, "alt": "red velvet", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }], "selected_variant": { "id": 43989110, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 74888074, "alt": "red velvet", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "first_available_variant": { "id": 43989110, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 74888074, "alt": "red velvet", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 43989110, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": null, "featured_image": { "id": 74888074, "alt": "red velvet", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "featured_image": { "id": 74888074, "alt": "red velvet", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 56310967, "alt": "Platinum Collection - Red Velvet Mood Shoot", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56310967.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56310967.jpeg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }, "images": [{ "id": 74888074, "alt": "red velvet", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 56310967, "alt": "Platinum Collection - Red Velvet Mood Shoot", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56310967.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56310967.jpeg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }], "media": [{ "id": 74888074, "alt": "red velvet", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 56310967, "alt": "Platinum Collection - Red Velvet Mood Shoot", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56310967.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/56310967.jpeg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }], "featured_media": { "id": 74888074, "alt": "red velvet", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888074.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2024-11-11T08:30:29.000+08:00", "created_at": "2023-04-18T10:06:04.000+08:00", "is_wishlisted": null }, { "id": 10860372, "handle": "onde-onde-1", "name": "Mini Royal Chocolate", "title": "Mini Royal Chocolate", "url": "\/products\/onde-onde-1", "price": 46.9, "price_min": "46.9", "price_max": "46.9", "price_varies": false, "compare_at_price": 0, "compare_at_price_min": "0.0", "compare_at_price_max": "0.0", "compare_at_price_varies": false, "available": true, "options_with_values": [], "options_by_name": [], "options": ["Title"], "has_only_default_variant": true, "sole_variant_id": 50102937, "variants": [{ "id": 50102937, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 70, "featured_image": { "id": 74888041, "alt": "royal chocolate", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }], "selected_variant": { "id": 50102937, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 70, "featured_image": { "id": 74888041, "alt": "royal chocolate", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "first_available_variant": { "id": 50102937, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 70, "featured_image": { "id": 74888041, "alt": "royal chocolate", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 50102937, "title": "Default Title", "sku": "", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 70, "featured_image": { "id": 74888041, "alt": "royal chocolate", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 4690, "compare_at_price": 0, "is_enabled": true, "options": ["Default Title"], "option1": "Default Title", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "featured_image": { "id": 74888041, "alt": "royal chocolate", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 65113546, "alt": "Royal-Chocolate", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/65113546.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/65113546.jpeg", "height": 1500, "width": 1000, "position": 2, "type": "Images" }, "images": [{ "id": 74888041, "alt": "royal chocolate", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 65113546, "alt": "Royal-Chocolate", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/65113546.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/65113546.jpeg", "height": 1500, "width": 1000, "position": 2, "type": "Images" }], "media": [{ "id": 74888041, "alt": "royal chocolate", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 65113546, "alt": "Royal-Chocolate", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/65113546.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/65113546.jpeg", "height": 1500, "width": 1000, "position": 2, "type": "Images" }], "featured_media": { "id": 74888041, "alt": "royal chocolate", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888041.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2023-11-07T19:16:00.000+08:00", "created_at": "2023-11-07T11:43:51.000+08:00", "is_wishlisted": null }, { "id": 6171089, "handle": "burnt-cheese", "name": "Burnt Cheesecake", "title": "Burnt Cheesecake", "url": "\/products\/burnt-cheese", "price": 72.9, "price_min": "72.9", "price_max": "72.9", "price_varies": false, "compare_at_price": 72.9, "compare_at_price_min": "72.9", "compare_at_price_max": "72.9", "compare_at_price_varies": false, "available": true, "options_with_values": [{ "name": "Size", "position": 1, "values": ["1R"] }], "options_by_name": { "Size": { "name": "Size", "position": 1, "values": ["1R"] } }, "options": ["Size"], "has_only_default_variant": false, "sole_variant_id": 27512619, "variants": [{ "id": 27512619, "title": "1R", "sku": null, "taxable": true, "barcode": null, "available": true, "inventory_quantity": 89, "featured_image": { "id": 74887250, "alt": "burnt cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 7290, "compare_at_price": 7290, "is_enabled": true, "options": ["1R"], "option1": "1R", "option2": null, "option3": null }], "selected_variant": { "id": 27512619, "title": "1R", "sku": null, "taxable": true, "barcode": null, "available": true, "inventory_quantity": 89, "featured_image": { "id": 74887250, "alt": "burnt cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 7290, "compare_at_price": 7290, "is_enabled": true, "options": ["1R"], "option1": "1R", "option2": null, "option3": null }, "first_available_variant": { "id": 27512619, "title": "1R", "sku": null, "taxable": true, "barcode": null, "available": true, "inventory_quantity": 89, "featured_image": { "id": 74887250, "alt": "burnt cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 7290, "compare_at_price": 7290, "is_enabled": true, "options": ["1R"], "option1": "1R", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 27512619, "title": "1R", "sku": null, "taxable": true, "barcode": null, "available": true, "inventory_quantity": 89, "featured_image": { "id": 74887250, "alt": "burnt cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 7290, "compare_at_price": 7290, "is_enabled": true, "options": ["1R"], "option1": "1R", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "featured_image": { "id": 74887250, "alt": "burnt cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 34933384, "alt": "Burnt Cheese Cake (side).jpg", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933384.jpg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933384.jpg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }, "images": [{ "id": 74887250, "alt": "burnt cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 34933384, "alt": "Burnt Cheese Cake (side).jpg", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933384.jpg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933384.jpg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }, { "id": 34933386, "alt": "Burnt Cheese Cake (slice).jpg", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933386.jpg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933386.jpg", "height": 1333, "width": 2000, "position": 3, "type": "Images" }], "media": [{ "id": 74887250, "alt": "burnt cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 34933384, "alt": "Burnt Cheese Cake (side).jpg", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933384.jpg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933384.jpg", "height": 2400, "width": 1600, "position": 2, "type": "Images" }, { "id": 34933386, "alt": "Burnt Cheese Cake (slice).jpg", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933386.jpg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/34933386.jpg", "height": 1333, "width": 2000, "position": 3, "type": "Images" }], "featured_media": { "id": 74887250, "alt": "burnt cheesecake", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887250.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2023-04-25T13:03:00.000+08:00", "created_at": "2021-09-24T18:16:50.000+08:00", "is_wishlisted": null }, { "id": 502066, "handle": "chocolate-chip-walnut", "name": "Chocolate Chip Walnut", "title": "Chocolate Chip Walnut", "url": "\/products\/chocolate-chip-walnut", "price": 52.9, "price_min": "52.9", "price_max": "398.0", "price_varies": true, "compare_at_price": 52.9, "compare_at_price_min": "52.9", "compare_at_price_max": "398.0", "compare_at_price_varies": true, "available": true, "options_with_values": [{ "name": "Size", "position": 1, "values": ["Regular", "1R", "2R", "3R", "4R", "6R"] }], "options_by_name": { "Size": { "name": "Size", "position": 1, "values": ["Regular", "1R", "2R", "3R", "4R", "6R"] } }, "options": ["Size"], "has_only_default_variant": false, "sole_variant_id": null, "variants": [{ "id": 4371362, "title": "Regular", "sku": "Chocolate Chip Walnut", "taxable": true, "barcode": null, "available": true, "inventory_quantity": 66, "featured_image": { "id": 74887744, "alt": "choc chip walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 5290, "compare_at_price": 5290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, { "id": 4371366, "title": "1R", "sku": "Chocolate Chip Walnut", "taxable": true, "barcode": null, "available": true, "inventory_quantity": 87, "featured_image": null, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["1R"], "option1": "1R", "option2": null, "option3": null }, { "id": 4371363, "title": "2R", "sku": "Chocolate Chip Walnut", "taxable": true, "barcode": null, "available": false, "inventory_quantity": 0, "featured_image": null, "price": 12800, "compare_at_price": 12800, "is_enabled": true, "options": ["2R"], "option1": "2R", "option2": null, "option3": null }, { "id": 4371364, "title": "3R", "sku": "Chocolate Chip Walnut", "taxable": true, "barcode": null, "available": true, "inventory_quantity": 5, "featured_image": null, "price": 19800, "compare_at_price": 19800, "is_enabled": true, "options": ["3R"], "option1": "3R", "option2": null, "option3": null }, { "id": 4371365, "title": "4R", "sku": "Chocolate Chip Walnut", "taxable": true, "barcode": null, "available": true, "inventory_quantity": 5, "featured_image": null, "price": 26800, "compare_at_price": 26800, "is_enabled": true, "options": ["4R"], "option1": "4R", "option2": null, "option3": null }, { "id": 4371367, "title": "6R", "sku": "Chocolate Chip Walnut", "taxable": true, "barcode": null, "available": true, "inventory_quantity": 5, "featured_image": null, "price": 39800, "compare_at_price": 39800, "is_enabled": true, "options": ["6R"], "option1": "6R", "option2": null, "option3": null }], "selected_variant": { "id": 4371362, "title": "Regular", "sku": "Chocolate Chip Walnut", "taxable": true, "barcode": null, "available": true, "inventory_quantity": 66, "featured_image": { "id": 74887744, "alt": "choc chip walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 5290, "compare_at_price": 5290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "first_available_variant": { "id": 4371362, "title": "Regular", "sku": "Chocolate Chip Walnut", "taxable": true, "barcode": null, "available": true, "inventory_quantity": 66, "featured_image": { "id": 74887744, "alt": "choc chip walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 5290, "compare_at_price": 5290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 4371362, "title": "Regular", "sku": "Chocolate Chip Walnut", "taxable": true, "barcode": null, "available": true, "inventory_quantity": 66, "featured_image": { "id": 74887744, "alt": "choc chip walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 5290, "compare_at_price": 5290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "featured_image": { "id": 74887744, "alt": "choc chip walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 15988134, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15988134.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15988134.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }, "images": [{ "id": 74887744, "alt": "choc chip walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 15988134, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15988134.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15988134.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }], "media": [{ "id": 74887744, "alt": "choc chip walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 15988134, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15988134.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/15988134.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }], "featured_media": { "id": 74887744, "alt": "choc chip walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887744.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2023-04-25T13:08:00.000+08:00", "created_at": "2012-10-31T22:50:28.000+08:00", "is_wishlisted": null }, { "id": 3836929, "handle": "salted-caramel-macadamia-cheese", "name": "Salted Caramel Macadamia Cheese", "title": "Salted Caramel Macadamia Cheese", "url": "\/products\/salted-caramel-macadamia-cheese", "price": 62.9, "price_min": "62.9", "price_max": "72.9", "price_varies": true, "compare_at_price": 62.9, "compare_at_price_min": "62.9", "compare_at_price_max": "72.9", "compare_at_price_varies": true, "available": true, "options_with_values": [{ "name": "Size", "position": 1, "values": ["Regular", "1R"] }], "options_by_name": { "Size": { "name": "Size", "position": 1, "values": ["Regular", "1R"] } }, "options": ["Size"], "has_only_default_variant": false, "sole_variant_id": null, "variants": [{ "id": 17376800, "title": "Regular", "sku": "Salted Caramel Macadamia Cheese", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 997, "featured_image": { "id": 74887467, "alt": "salted caramel macadamia", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, { "id": 17654765, "title": "1R", "sku": "Salted Caramel Macadamia Cheese", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 999, "featured_image": null, "price": 7290, "compare_at_price": 7290, "is_enabled": true, "options": ["1R"], "option1": "1R", "option2": null, "option3": null }], "selected_variant": { "id": 17376800, "title": "Regular", "sku": "Salted Caramel Macadamia Cheese", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 997, "featured_image": { "id": 74887467, "alt": "salted caramel macadamia", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "first_available_variant": { "id": 17376800, "title": "Regular", "sku": "Salted Caramel Macadamia Cheese", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 997, "featured_image": { "id": 74887467, "alt": "salted caramel macadamia", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 17376800, "title": "Regular", "sku": "Salted Caramel Macadamia Cheese", "taxable": true, "barcode": "", "available": true, "inventory_quantity": 997, "featured_image": { "id": 74887467, "alt": "salted caramel macadamia", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 6290, "compare_at_price": 6290, "is_enabled": true, "options": ["Regular"], "option1": "Regular", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "featured_image": { "id": 74887467, "alt": "salted caramel macadamia", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 16182637, "alt": "Salted Caramel Macadamia Cheese (side).jpg", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16182637.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16182637.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }, "images": [{ "id": 74887467, "alt": "salted caramel macadamia", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 16182637, "alt": "Salted Caramel Macadamia Cheese (side).jpg", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16182637.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16182637.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }], "media": [{ "id": 74887467, "alt": "salted caramel macadamia", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 16182637, "alt": "Salted Caramel Macadamia Cheese (side).jpg", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16182637.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16182637.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }], "featured_media": { "id": 74887467, "alt": "salted caramel macadamia", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74887467.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2024-07-03T10:13:00.000+08:00", "created_at": "2020-07-24T11:43:34.000+08:00", "is_wishlisted": null }, { "id": 502048, "handle": "brownies-walnut", "name": "Brownies Walnut", "title": "Brownies Walnut", "url": "\/products\/brownies-walnut", "price": 39, "price_min": "39.0", "price_max": "62.0", "price_varies": true, "compare_at_price": 39, "compare_at_price_min": "39.0", "compare_at_price_max": "62.0", "compare_at_price_varies": true, "available": true, "options_with_values": [{ "name": "Size", "position": 1, "values": ["8 Slice", "12 Slice", "20 Slice"] }], "options_by_name": { "Size": { "name": "Size", "position": 1, "values": ["8 Slice", "12 Slice", "20 Slice"] } }, "options": ["Size"], "has_only_default_variant": false, "sole_variant_id": null, "variants": [{ "id": 28364521, "title": "8 Slice", "sku": "Brownies Walnut", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74888128, "alt": "brownies walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 3900, "compare_at_price": 3900, "is_enabled": true, "options": ["8 Slice"], "option1": "8 Slice", "option2": null, "option3": null }, { "id": 28364523, "title": "12 Slice", "sku": "Brownies Walnut", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 5100, "compare_at_price": 5100, "is_enabled": true, "options": ["12 Slice"], "option1": "12 Slice", "option2": null, "option3": null }, { "id": 4371301, "title": "20 Slice", "sku": "Brownies Walnut", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": null, "price": 6200, "compare_at_price": 6200, "is_enabled": true, "options": ["20 Slice"], "option1": "20 Slice", "option2": null, "option3": null }], "selected_variant": { "id": 28364521, "title": "8 Slice", "sku": "Brownies Walnut", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74888128, "alt": "brownies walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 3900, "compare_at_price": 3900, "is_enabled": true, "options": ["8 Slice"], "option1": "8 Slice", "option2": null, "option3": null }, "first_available_variant": { "id": 28364521, "title": "8 Slice", "sku": "Brownies Walnut", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74888128, "alt": "brownies walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 3900, "compare_at_price": 3900, "is_enabled": true, "options": ["8 Slice"], "option1": "8 Slice", "option2": null, "option3": null }, "selected_or_first_available_variant": { "id": 28364521, "title": "8 Slice", "sku": "Brownies Walnut", "taxable": true, "barcode": null, "available": true, "inventory_quantity": null, "featured_image": { "id": 74888128, "alt": "brownies walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "price": 3900, "compare_at_price": 3900, "is_enabled": true, "options": ["8 Slice"], "option1": "8 Slice", "option2": null, "option3": null }, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "featured_image": { "id": 74888128, "alt": "brownies walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "secondary_image": { "id": 16011869, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16011869.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16011869.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }, "images": [{ "id": 74888128, "alt": "brownies walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 16011869, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16011869.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16011869.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }], "media": [{ "id": 74888128, "alt": "brownies walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, { "id": 16011869, "alt": null, "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16011869.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/16011869.jpeg", "height": 2400, "width": 1601, "position": 2, "type": "Images" }], "featured_media": { "id": 74888128, "alt": "brownies walnut", "img_url": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "src": "https:\/\/cdn.store-assets.com\/s\/896\/i\/74888128.jpeg", "height": 660, "width": 792, "position": 1, "type": "Images" }, "metafields": [], "expires": null, "published_at": "2023-04-25T13:23:00.000+08:00", "created_at": "2012-10-16T23:46:14.000+08:00", "is_wishlisted": null }], "sort_by": "featured" }

        EasyStore.Event.dispatch('collections/viewed', { collection })

    }

    function onProductView() {

        const product = ""

        EasyStore.Event.dispatch("products/viewed", { product })

    }

    function onProductShare(el) {

        const product = ""

        const channel = el.getAttribute("class").split("-").last()

        EasyStore.Event.dispatch('products/shared', { product, channel })

    }

    function onWishlistItemAdded() {

        let product = ""
        const quantity = _selector("#Quantity").value

        EasyStore.Event.dispatch('wishlists/item_added', { product })

    }

    async function onCartItemsAdded() {

        const cart = await getCart()

        if (cart && cart.items != undefined && cart.items.length > 0) {

            EasyStore.Event.dispatch('carts/item_added', { cart })

        }

    }

    async function onCartView() {

        const cart = await getCart()

        EasyStore.Event.dispatch('carts/viewed', { cart })

    }

    async function onCartItemRemoved() {

        const cart = await getCart()

        cart.items = []

        if (cart) {

            EasyStore.Event.dispatch('carts/item_removed', { cart })

        }

    }

    async function onCheckoutInitiate() {

        const cart = await getCart()

        EasyStore.Event.dispatch('checkouts/initiated', { cart })

    }

    async function onShippingInfoAdded(form) {
        let checkout = getCheckout()

        let form_data = {}
        new FormData(form).forEach((value, key) => form_data[key] = value)

        let shipping_tier = null

        if (form_data.type && form_data.type.startsWith("r_pickup")) {
            shipping_tier = `Pickup - ${form_data.pick_location}`
        }

        if (form_data.s_id) {
            shipping_tier = _selector(`input[id='` + form_data.s_id + `']`).getAttribute("data-shipping-name")
        }

        if (!shipping_tier) return

        EasyStore.Event.dispatch('checkouts/shipping_info_added', { checkout, shipping_tier })

    }

    async function onPaymentInfoAdded(form) {

        let checkout = getCheckout()

        let payment_type = new FormData(form).get('payment_method')

        EasyStore.Event.dispatch("checkouts/payment_info_added", { checkout, payment_type })

    }

    async function onOrderPlace() {

        let cart_token = getCookie("cart_js")
        let previous_cart_token = getCookie("previous_cart_ga4_js")

        if (previous_cart_token && previous_cart_token == cart_token) {
            // Prevent duplicate purchase tracking
            return
        }

        let order = getOrder()

        EasyStore.Event.dispatch('orders/placed', { order })

        if (order.is_manual_payment) {

            EasyStore.Event.dispatch('orders/purchased', { order })

        }

        const last_transaction = order.transactions.last()

        if (last_transaction.status) {

            EasyStore.Event.dispatch('orders/purchased', { order })
            EasyStore.Event.dispatch('payments/captured', { order })

        }

    }

    async function onPaymentFail() {

        const order = getOrder()

        EasyStore.Event.dispatch('payments/failed', { order })

    }

    async function onCheckoutComplete(form) {

        onPaymentInfoAdded(form)

        const checkout = getCheckout()

        EasyStore.Event.dispatch('checkouts/completed', { checkout })

    }

    async function onSinglePageCheckout() {

        // let checkout = $("[data-app-checkout]").data("app-checkout")

        let checkout = getCheckout()

        // const payment_type = _selector("#app_spc_payment_method").find(`[class*="label-content"]`).first().find("b").first().text()
        const payment_type = _selector("#app_spc_payment_method").getElementsByClassName('label-content')[0].getElementsByTagName('b')[0].innerHTML

        const shipping_method = _selector("#delivery_method").value

        let shipping_tier = null
        let app_spc_customer_info_label = _selector("#app_spc_customer_info").getElementsByClassName('label-content')
        if (shipping_method == "shipping") {
            shipping_tier = app_spc_customer_info_label[app_spc_customer_info_label.length - 1].getElementsByTagName('b')[0].innerHTML
        }

        if (shipping_method == "pickup") {
            shipping_tier = app_spc_customer_info_label[0].innerHTML
        }

        if (shipping_tier) {

            EasyStore.Event.dispatch('checkouts/shipping_info_added', {
                checkout,
                shipping_tier,
            })

        }

        if (payment_type) {

            EasyStore.Event.dispatch('checkouts/payment_info_added', {
                checkout,
                payment_type,
            })

        }

        EasyStore.Event.dispatch('checkouts/completed', { checkout })

    }

})


//-----------------------//
//       Functions       //
//-----------------------//

function getCookie(name) {

    name += "="

    decodedCookie = decodeURIComponent(document.cookie)

    ca = decodedCookie.split(";")

    for (i = 0; i < ca.length; i++) {
        c = ca[i]
        while (c.charAt(0) == " ") {
            c = c.substring(1)
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length)
        }
    }

    return ""

}

const parsePrice = price => {
    if (typeof price === 'string') {
        return parseFloat(price.split(',').join(''))
    }

    return price
}

const requestCart = async (method, data) => {

    let response = await fetch('/cart.json', { method: 'GET', headers: { 'Content-Type': 'application/json' } })
    result = await response.json()

    return result.cart

}
const getCart = async (latest = false) => {

    let cart = window.__latest_cart

    const cart_invalid = !cart || !cart.items || (cart.total_price > 0 && !cart.items.length)

    if (latest || cart_invalid) {
        cart = await requestCart()
    }

    cart.items = cart.items || []

    return mapCart(cart)

}

const getCheckout = async () => {
    mapCheckout(window.__latest_cart || await requestCart())
}

const getOrder = async () => {
    mapOrder(window.__latest_cart || await requestCart())
}

//-----------------------//
//        Mappers        //
//-----------------------//

const fallbackAttribute = (object, attribute) => {

    if (!Array.isArray(attribute)) {
        attribute = [attribute]
    }

    let final_value = null

    do {

        final_value = object[attribute.shift()]

    } while (!final_value && attribute.length)

    return final_value

}

const map = (object, mapper) => {

    const newObject = {}

    for (const key in mapper) {

        // Handle different keys between new and old format
        newObject[key] = fallbackAttribute(object, mapper[key])

        // Cast price to float
        if (newObject[key] && ['price', 'amount', 'discount', 'discounts'].some(x => key.endsWith(x))) {
            newObject[key] = parsePrice(newObject[key])
        }

        if (newObject[key] === undefined) {
            delete newObject[key]
        }

    }

    return newObject

}

const mapCart = cart => {

    const oldCart = cart

    const mapper = {
        id: 'id',
        currency: 'currency',
        item_count: 'item_count',
        items: 'items',
        total_price: 'total_price',
        latest_items: 'latest_items'
    }

    cart = map(cart, mapper)

    const discounts = (oldCart.storewide_discounts || []).concat((oldCart.voucher_discounts || []))

    cart.discount_applications = discounts.map(discount => ({
        title: discount.voucher_code || null,
        value: parsePrice(discount.amount),
    }))

    cart.original_total_price = cart.items.length
        ? cart.items
            .map(item => item.original_price)
            .reduce((sum, price) => sum + price)
        : 0

    cart.total_discount = cart.discount_applications.length
        ? cart.discount_applications
            .map(discount => parsePrice(discount.value))
            .reduce((sum, value) => sum + value)
        : 0

    cart.items = cart.items.map(item => mapLineItem(item))

    return cart

}

const mapCheckout = checkout => {

    const mapper = {
        note: 'note',
        attributes: 'note_attributes',
        billing_address: 'billing_address',
        currency: 'currency',
        customer_id: 'customer_id',
        discounts_amount: 'total_discount',
        id: 'id',
        line_items: 'order_item',
        order_number: 'order_number',
        shipping_address: 'shipping_address',
        shipping_price: 'shipping_tax',
        shipping_method: 'shipping_method_name',
        tax_price: 'total_tax',
    }

    checkout = map(checkout, mapper)

    checkout.requires_shipping = checkout.line_items.some(item => item.shipping_required)

    checkout.line_items = checkout.line_items.map(item => mapLineItem(item))

    return checkout

}

const mapOrder = order => {

    const mapper = {
        attributes: 'note_attributes',
        billing_address: 'billing_address',
        cancelled: 'is_cancelled',
        cancelled_at: 'cancelled_at',
        created_at: 'created_at',
        customer_id: 'customer_id',
        // discount_applications: 'discount_applications',
        email: 'email',
        financial_status: 'financial_status',
        fulfillment_status: 'fulfillment_status',
        line_items: 'order_item',
        note: 'note',
        order_number: 'order_number',
        phone: 'phone',
        shipping_address: 'shipping_address',
        shipping_methods: 'shipping_methods',
        shipping_price: 'total_shipping',
        subtotal_price: 'subtotal_price',
        // tax_lines: 'tax_lines',
        tax_price: 'total_tax',
        total_discounts: 'total_discount',
        total_net_amount: 'total_amount_include_transaction',
        total_price: 'total_price',
        transactions: 'transaction_records',
        is_manual_payment: 'is_manual_payment',
    }

    order.email = order.billing_address.email
    order.phone = order.billing_address.phone
    order.shipping_method = order.shipping_method_name

    order = map(order, mapper)

    order.line_items = order.line_items.map(item => mapLineItem(item))
    order.transactions = order.transactions.map(transaction => mapTransaction(transaction))

    return order

}

const mapLineItem = line_item => {

    const old_line_item = line_item

    const mapper = {
        final_price: 'price',
        image: 'img_url',
        message: 'message',
        original_line_price: 'original_line_price',
        original_price: 'original_price',
        properties: 'properties',
        quantity: 'quantity',
        requires_shipping: 'shipping_required',
        sku: 'sku',
        taxable: 'taxable',
        title: 'product_name',
        product_name: 'product_name',
        url: 'url',
        product_id: 'product_id',
        variant_id: 'variant_id',
        id: ['id', 'i_id'],
    }

    line_item = map(line_item, mapper)

    line_item.product_id = line_item.product_id || (old_line_item.product && old_line_item.product.id) || null
    line_item.variant_id = line_item.variant_id || (old_line_item.variant && old_line_item.variant.id) || null
    line_item.image = line_item.image || (old_line_item.image && old_line_item.image.url) || null

    return line_item

}

const mapTransaction = transaction => {

    const mapper = {
        amount: 'amount',
        created_at: 'created_at',
        gateway: 'gateway_type',
        id: 'id',
        status: 'status',
    }

    transaction = map(transaction, mapper)

    return transaction

}



function getFocusableElements(container) {
    return Array.from(
        container.querySelectorAll(
            "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
        )
    );
}

const trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
    var elements = getFocusableElements(container);
    var first = elements[0];
    var last = elements[elements.length - 1];

    removeTrapFocus();

    trapFocusHandlers.focusin = (event) => {
        if (
            event.target !== container &&
            event.target !== last &&
            event.target !== first
        )
            return;

        document.addEventListener('keydown', trapFocusHandlers.keydown);
    };

    trapFocusHandlers.focusout = function () {
        document.removeEventListener('keydown', trapFocusHandlers.keydown);
    };

    trapFocusHandlers.keydown = function (event) {
        if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
        // On the last focusable element and tab forward, focus the first element.
        if (event.target === last && !event.shiftKey) {
            event.preventDefault();
            first.focus();
        }

        //  On the first focusable element and tab backward, focus the last element.
        if (
            (event.target === container || event.target === first) &&
            event.shiftKey
        ) {
            event.preventDefault();
            last.focus();
        }
    };

    document.addEventListener('focusout', trapFocusHandlers.focusout);
    document.addEventListener('focusin', trapFocusHandlers.focusin);

    elementToFocus.focus();
}

const serializeForm = form => {
    const obj = {};
    const formData = new FormData(form);
    for (const key of formData.keys()) {
        const regex = /(?:^(properties\[))(.*?)(?:\]$)/;
        let matches_array = key.match(/\[\]/);

        if (matches_array) {
            let new_key = key.replace(/[^a-zA-Z0-9_-]/g, "")

            obj[new_key] = new FormData(form).getAll(key)

        } else if (regex.test(key)) {
            obj.properties = obj.properties || {};
            obj.properties[regex.exec(key)[2]] = formData.get(key);
        } else {
            obj[key] = formData.get(key);
        }
    }
    console.log('obj', obj);
    return JSON.stringify(obj);
};

function removeTrapFocus(elementToFocus = null) {
    document.removeEventListener('focusin', trapFocusHandlers.focusin);
    document.removeEventListener('focusout', trapFocusHandlers.focusout);
    document.removeEventListener('keydown', trapFocusHandlers.keydown);

    if (elementToFocus) elementToFocus.focus();
}

function pauseAllMedia() {
    document.querySelectorAll('.js-youtube').forEach((video) => {
        video.contentWindow.postMessage('{"event":"command","func":"' + 'pauseVideo' + '","args":""}', '*');
    });
    document.querySelectorAll('.js-vimeo').forEach((video) => {
        video.contentWindow.postMessage('{"method":"pause"}', '*');
    });
    document.querySelectorAll('video').forEach((video) => video.pause());
    document.querySelectorAll('product-model').forEach((model) => {
        if (model.modelViewerUI) modelViewerUI.pause();
    });
}

function debounce(fn, wait) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

document.querySelectorAll('.rte table').forEach((table) => {
    table.outerHTML = '<div class="table-wrapper">' + table.outerHTML + '</div>'
})

class QuantityInput extends HTMLElement {
    constructor() {
        super();
        this.input = this.querySelector('input');
        this.changeEvent = new Event('change', { bubbles: true })

        this.querySelectorAll('button').forEach(
            (button) => button.addEventListener('click', this.onButtonClick.bind(this))
        );
    }

    onButtonClick(event) {
        event.preventDefault();
        const previousValue = this.input.value;

        event.target.name === 'plus' ? this.input.stepUp() : this.input.stepDown();
        if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);
    }
}

customElements.define('quantity-input', QuantityInput);

class VariantSelects {

    onVariantChange(selected_variant) {
        this.currentVariant = selected_variant
        this.productForm = document.getElementById('AddToCartForm');
        this.productInfo = document.getElementById('ProductInfo');
        this.toggleAddButton(true, '', false);
        this.updateProductPrice();

        if (!this.currentVariant || (!this.currentVariant.available && this.currentVariant.inventory_quantity != 0)) {
            this.toggleAddButton(true, '', true);
            this.setUnavailable();
        } else {

            const price = document.getElementById('price');
            if (price) price.classList.remove('visibility-hidden');
            this.toggleAddButton(!this.currentVariant.available, window.variantStrings.soldOut);
        }
    }

    updateVariantsUnavailable(all_variants, variants_unavailable) {
        let match_disabled_variant = {};
        variants_unavailable.forEach((variant_unavailable) => {
            let matched_variant = this.matchVariantUnavailable(this.currentVariant.options, variant_unavailable.options)
            if (matched_variant) {
                Object.keys(matched_variant).forEach(key => {
                    let option_index = `option${Number(key) + 1}`;
                    match_disabled_variant[option_index] = match_disabled_variant[option_index] ?? [];
                    if (key == '0' && this.currentVariant.options.length > 1) {
                        match_disabled_variant[option_index].push(...this.matchOptionUnavailable(key, matched_variant[key], variants_unavailable, all_variants));
                    } else {
                        match_disabled_variant[option_index].push(...matched_variant[key]);
                    }
                });
            }
        })

        this.productForm.querySelectorAll(`.disabled`).forEach((el) => {
            el.classList.remove('disabled'), el.removeAttribute("disabled");
        })

        Object.entries(match_disabled_variant).forEach(([key, values]) => {
            values.forEach(value => {
                let escaped_value = value.replace(/'/g, "\\'"),
                    el = this.productForm.querySelector(`[data-option='${key}'] [value='${escaped_value}']`);
                el.classList.add('disabled');
                // el.disabled = true;
            });
        });

    }

    matchVariantUnavailable(selected_variant, variant_unavailable) {
        let matches = selected_variant.filter((value, index) => variant_unavailable[index] == value);
        if (matches.length == selected_variant.length - 1) {
            let option_unavailable = variant_unavailable.filter((value, index) => selected_variant[index] != value),
                option_index = variant_unavailable.findIndex(value => option_unavailable.includes(value));
            return { [option_index]: option_unavailable };
        }
        return false;
    }

    matchOptionUnavailable(index, options, variants_unavailable, all_variants) {
        let total_unavailable_option = [];
        options.forEach(option => {
            let matches_available = all_variants.filter((value) => value.options[index] == option),
                matches_unavailable = variants_unavailable.filter((value) => value.options[index] == option);

            if (matches_available.length == matches_unavailable.length) total_unavailable_option.push(option)
        })
        return total_unavailable_option;
    }

    toggleAddButton(disable = true, text, modifyClass = true) {
        if (!this.productForm) return;

        const addButton = this.productForm.querySelector('[name="add"]');
        if (!addButton) return;

        if (disable) {
            addButton.setAttribute('disabled', true);
            if (text) addButton.innerHTML = text;
        } else {
            addButton.removeAttribute('disabled');
            addButton.innerHTML = window.variantStrings.addToCart;
        }

        if (!modifyClass) return;
    }


    updateProductPrice() {
        [...this.productInfo.querySelectorAll('.price-item .money')].map((el) => {
            el.innerHTML = EasyStore.Currencies.formatMoney(this.currentVariant.price)
        });
        [...this.productInfo.querySelectorAll('.price__compare .money')].map((el) => {
            el.innerHTML = EasyStore.Currencies.formatMoney(this.currentVariant.compare_at_price)
        });

        this.productInfo.querySelector('#price .price').classList.remove('price--sold-out', 'price--on-sale')
        this.productInfo.querySelector('.product-form__quantity').style.display = ''
        this.productInfo.querySelector('.product-form__submit').style.display = ''

        if (this.currentVariant.compare_at_price > this.currentVariant.price) this.productInfo.querySelector('#price .price').classList.add('price--on-sale')
        if (!this.currentVariant.available && this.currentVariant.inventory_quantity <= 0) {
            this.productInfo.querySelector('#price .price').classList.add('price--sold-out')
            this.productInfo.querySelector('.product-form__quantity').style.display = 'none'
        }

        if (this.currentVariant.price <= 0) {
            this.productInfo.querySelector('.product-form__quantity').style.display = 'none'
            this.productInfo.querySelector('.product-form__submit').style.display = 'none'
        }

    }

    setUnavailable() {
        const button = document.getElementById('AddToCartForm');
        const addButton = button.querySelector('[name="add"]');
        const price = document.getElementById('price');
        if (!addButton) return;
        addButton.innerHTML = window.variantStrings.unavailable;
        if (price) price.classList.add('visibility-hidden');
    }

}
const VariantSelector = new VariantSelects;


class MenuDrawer extends HTMLElement {
    constructor() {
        super();

        this.mainDetailsToggle = this.querySelector('details');
        const summaryElements = this.querySelectorAll('summary');
        this.addAccessibilityAttributes(summaryElements);

        if (navigator.platform === 'iPhone') document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);

        this.addEventListener('keyup', this.onKeyUp.bind(this));
        this.addEventListener('focusout', this.onFocusOut.bind(this));
        this.bindEvents();
    }

    bindEvents() {
        this.querySelectorAll('summary').forEach(summary => summary.addEventListener('click', this.onSummaryClick.bind(this)));
        this.querySelectorAll('button').forEach(button => button.addEventListener('click', this.onCloseButtonClick.bind(this)));
    }

    addAccessibilityAttributes(summaryElements) {
        summaryElements.forEach(element => {
            element.setAttribute('role', 'button');
            element.setAttribute('aria-expanded', false);
            element.setAttribute('aria-controls', element.nextElementSibling.id);
        });
    }

    onKeyUp(event) {
        if (event.code.toUpperCase() !== 'ESCAPE') return;

        const openDetailsElement = event.target.closest('details[open]');
        if (!openDetailsElement) return;

        openDetailsElement === this.mainDetailsToggle ? this.closeMenuDrawer(this.mainDetailsToggle.querySelector('summary')) : this.closeSubmenu(openDetailsElement);
    }

    onSummaryClick(event) {
        const summaryElement = event.currentTarget;
        const detailsElement = summaryElement.parentNode;
        const isOpen = detailsElement.hasAttribute('open');

        if (detailsElement === this.mainDetailsToggle) {
            if (isOpen) event.preventDefault();
            isOpen ? this.closeMenuDrawer(summaryElement) : this.openMenuDrawer(summaryElement);
        } else {
            trapFocus(summaryElement.nextElementSibling, detailsElement.querySelector('button'));

            setTimeout(() => {
                detailsElement.classList.add('menu-opening');
            });
        }
    }

    openMenuDrawer(summaryElement) {
        setTimeout(() => {
            this.mainDetailsToggle.classList.add('menu-opening');
        });
        summaryElement.setAttribute('aria-expanded', true);
        trapFocus(this.mainDetailsToggle, summaryElement);
        document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
    }

    closeMenuDrawer(event, elementToFocus = false) {
        if (event !== undefined) {
            this.mainDetailsToggle.classList.remove('menu-opening');
            this.mainDetailsToggle.querySelectorAll('details').forEach(details => {
                details.removeAttribute('open');
                details.classList.remove('menu-opening');
            });
            this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', false);
            document.body.classList.remove(`overflow-hidden-${this.dataset.breakpoint}`);
            removeTrapFocus(elementToFocus);
            this.closeAnimation(this.mainDetailsToggle);
        }
    }

    onFocusOut(event) {
        setTimeout(() => {
            if (this.mainDetailsToggle.hasAttribute('open') && !this.mainDetailsToggle.contains(document.activeElement)) this.closeMenuDrawer();
        });
    }

    onCloseButtonClick(event) {
        const detailsElement = event.currentTarget.closest('details');
        this.closeSubmenu(detailsElement);
    }

    closeSubmenu(detailsElement) {
        detailsElement.classList.remove('menu-opening');
        removeTrapFocus();
        this.closeAnimation(detailsElement);
    }

    closeAnimation(detailsElement) {
        let animationStart;

        const handleAnimation = (time) => {
            if (animationStart === undefined) {
                animationStart = time;
            }

            const elapsedTime = time - animationStart;

            if (elapsedTime < 400) {
                window.requestAnimationFrame(handleAnimation);
            } else {
                detailsElement.removeAttribute('open');
                if (detailsElement.closest('details[open]')) {
                    trapFocus(detailsElement.closest('details[open]'), detailsElement.querySelector('summary'));
                }
            }
        }

        window.requestAnimationFrame(handleAnimation);
    }
}

customElements.define('menu-drawer', MenuDrawer);

class HeaderDrawer extends MenuDrawer {
    constructor() {
        super();
    }

    openMenuDrawer(summaryElement) {
        this.header = this.header || document.getElementById('easystore-section-header');
        this.borderOffset = this.borderOffset || this.closest('.header-wrapper').classList.contains('header-wrapper--border-bottom') ? 1 : 0;
        document.documentElement.style.setProperty('--header-bottom-position', `${parseInt(this.header.getBoundingClientRect().bottom - this.borderOffset)}px`);

        setTimeout(() => {
            this.mainDetailsToggle.classList.add('menu-opening');
        });

        summaryElement.setAttribute('aria-expanded', true);
        trapFocus(this.mainDetailsToggle, summaryElement);
        document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
    }
}

customElements.define('header-drawer', HeaderDrawer);

class DeferredMedia extends HTMLElement {
    constructor() {
        super();
        const poster = this.querySelector('[id^="Deferred-Poster-"]');
        if (!poster) return;
        poster.addEventListener('click', this.loadContent.bind(this));

        let youtube_id = this.querySelector('iframe').getAttribute('data-video-id'),
            VID_REGEX = /(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        if (youtube_id.match(VID_REGEX) != null) youtube_id = youtube_id.match(VID_REGEX)[1];
        this.querySelector('iframe').src = `https://www.youtube.com/embed/${youtube_id}?enablejsapi=1&rel=0`
    }

    loadContent() {
        window.pauseAllMedia();
        if (!this.getAttribute('loaded')) {

            this.setAttribute('loaded', true);
            this.querySelector('video, model-viewer, iframe').focus();

            this.querySelectorAll('.js-youtube').forEach((video) => {
                video.contentWindow.postMessage('{"event":"command","func":"' + 'playVideo' + '","args":""}', '*');
            });

        }
    }
}

customElements.define('deferred-media', DeferredMedia);

class SliderComponent extends HTMLElement {
    constructor() {
        super();
        this.slider = this.querySelector('ul');
        this.sliderItems = this.querySelectorAll('li');
        this.pageCount = this.querySelector('.slider-counter--current');
        this.pageTotal = this.querySelector('.slider-counter--total');
        this.prevButton = this.querySelector('button[name="previous"]');
        this.nextButton = this.querySelector('button[name="next"]');

        if (!this.slider || !this.nextButton) return;

        const resizeObserver = new ResizeObserver(entries => this.initPages());
        resizeObserver.observe(this.slider);

        this.slider.addEventListener('scroll', this.update.bind(this));
        this.prevButton.addEventListener('click', this.onButtonClick.bind(this));
        this.nextButton.addEventListener('click', this.onButtonClick.bind(this));
    }

    initPages() {
        const sliderItemsToShow = Array.from(this.sliderItems).filter(element => element.clientWidth > 0);
        this.sliderLastItem = sliderItemsToShow[sliderItemsToShow.length - 1];
        if (sliderItemsToShow.length === 0) return;
        this.slidesPerPage = Math.floor(this.slider.clientWidth / sliderItemsToShow[0].clientWidth);
        this.totalPages = sliderItemsToShow.length - this.slidesPerPage + 1;
        this.update();
    }

    update() {
        if (!this.pageCount || !this.pageTotal) return;
        this.currentPage = Math.round(this.slider.scrollLeft / this.sliderLastItem.clientWidth) + 1;

        if (this.currentPage === 1) {
            this.prevButton.setAttribute('disabled', true);
        } else {
            this.prevButton.removeAttribute('disabled');
        }

        if (this.currentPage === this.totalPages) {
            this.nextButton.setAttribute('disabled', true);
        } else {
            this.nextButton.removeAttribute('disabled');
        }

        this.pageCount.textContent = this.currentPage;
        this.pageTotal.textContent = this.totalPages;
    }

    onButtonClick(event) {
        console.log('onButtonClick');
        event.preventDefault();
        const slideScrollPosition = event.currentTarget.name === 'next' ? this.slider.scrollLeft + this.sliderLastItem.clientWidth : this.slider.scrollLeft - this.sliderLastItem.clientWidth;
        this.slider.scrollTo({
            left: slideScrollPosition
        });
    }
}

customElements.define('slider-component', SliderComponent);

class AddToCartButton extends HTMLElement {
    constructor() {
        super();

        this.loading = this.querySelector('.loading-overlay');
        this.button = this.querySelector('.addToClassList');
        this.button.addEventListener('click', this.onSubmitHandler.bind(this));
        this.cartNotification = document.querySelector('cart-notification');
    }

    onSubmitHandler(evt) {

        if (this.button.dataset.variantId && this.button.dataset.variantId != '') {

            evt.preventDefault();
            this.cartNotification.setActiveElement(document.activeElement);

            this.button.classList.add('transparent');
            this.loading.classList.remove('hidden');

            const body = {
                _token: this.button.dataset.token,
                id: this.button.dataset.variantId,
                quantity: this.button.dataset.quantity
            }

            EasyStore.Action.addToCart(body, (cart) => {

                if (window.location.pathname == '/cart') {
                    location.reload()
                } else if (cart.item_count != undefined && cart.latest_items != undefined) {
                    this.cartNotification.renderContents(cart)
                }

                console.log('addToCart', cart);
                this.button.classList.remove('transparent');
                this.loading.classList.add('hidden');
            })
        }


    }

}

customElements.define('add-to-cart-button', AddToCartButton);



(function (i, s, o, g, r, a, m) {
    i['GoogleAnalyticsObject'] = r; i[r] = i[r] || function () {
        (i[r].q = i[r].q || []).push(arguments)
    }, i[r].l = 1 * new Date(); a = s.createElement(o),
        m = s.getElementsByTagName(o)[0]; a.async = 1; a.src = g; m.parentNode.insertBefore(a, m)
})(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');

ga('create', '', 'auto', 'myTracker');
ga('myTracker.send', 'pageview');



const register_tab = document.querySelector('#tab-register');
const login_tab = document.querySelector('#tab-login');
const register_tos = document.querySelector('#register-tos');

register_tab.addEventListener('click', function () {
    register_tos.style.display = 'block';
});
login_tab.addEventListener('click', function () {
    register_tos.style.display = 'none';
});

let lastPathSegment = window.location.pathname.split('/').filter(segment => segment.length > 0).pop();
if (lastPathSegment == 'login') {
    document.querySelector('#tab-' + lastPathSegment).checked = true;
    register_tos.style.display = 'none';
} else {
    register_tos.style.display = 'block';
}

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const phonePattern = /^(?:\+?\d{1,3}[\s-]?)?(?:\d{1,14}[\s-]?){1,5}$/;

let form = document.querySelector('#form-login'),
    input = document.querySelector('#CustomerDetail'),
    error_content = document.querySelector('#error-content');


form.addEventListener('submit', function (event) {
    // alert('addEventListener submit')
    event.preventDefault();

    let input_value = input.value
    error_content.innerHTML = '';
    if (!input_value.match(emailPattern) && !input_value.match(phonePattern)) {
        error_content.innerHTML = `<div class="errors note">Invalid Email or Phone</div>`;
        return false;
    }

    document.querySelector('#form-login .btn').classList.add('btn--loading', 'loading');

    grecaptcha.ready(function () {
        grecaptcha.execute('6LfLZ5koAAAAAGeuMiK78UL-0Jr-fhC9eKQ1vGbp', { action: 'submit' }).then(function (token) {

            // Add the token to the hidden input field
            document.getElementById('recaptchaResponse').value = token;

            // Submit the form
            document.getElementById('form-login').submit();
        });
    });
});



class EasyStoreEvents {

    constructor() {
        this.stack = {};
    }

    subscribe(event, callback) {

        if (!this.stack[event]) this.stack[event] = []
        this.stack[event].push(callback);

        console.log('EasyStore.Event.subscribe', event)
    }

    dispatch(event, data = {}) {

        // New
        if (event.includes('/')) {

            data = {
                store: {
                    host: 'https://' + location.hostname,
                },
                ...data,
            }

            // Old
        } else {

            data = this.tempDataMapper(event, data)

        }

        console.log(event, data)

        if (this.stack[event]) {

            this.stack[event].forEach((subscriber) => {
                subscriber(data)
            });

            console.log('EasyStore.Event.dispatch', event, data)

        }

    }

    // Deprecating
    tempDataMapper(event, source) {

        switch (event) {
            case 'ProductView':
                var data = {
                    product: {
                        id: source.product.id,
                        title: source.product.title,
                        url: source.store.host + source.product.url,
                        price: source.product.price,
                        collections: source.product.collections.map(function (value, index) { return value.title }).join(', '),
                        image_url: source.product.images[0].src,
                    }
                }
                break;
            case 'CollectionView':
                var data = {
                    collection: {
                        id: source.collection.id,
                        title: source.collection.title,
                        url: source.store.host + '/collections/' + source.collection.handle,
                    }
                }
                break;
            case 'PageView':
                var data = {
                    page: {
                        id: source.page.id,
                        title: source.page.title,
                        url: source.store.host + source.page.url,
                    }
                }
                break;
            case 'ArticleView':
                var data = {
                    article: {
                        id: source.article.id,
                        title: source.article.title,
                        url: source.store.host + source.article.url,
                    }
                }
                break;
            case 'Search':
                var data = {
                    search: {
                        term: source.search.terms,
                        url: source.store.host + '/search?q=' + source.search.terms,
                    }
                }
                break;
            case 'CartItemAdd':
                var data = {
                    item: {
                        product_id: source.item.product_id,
                        product_title: source.item.product_name,
                        variant_id: source.item.variant_id,
                        variant_title: source.item.variant_name,
                        collections: source.item.collections.split(',').join(', '),
                        price: source.item.price,
                        quantity: source.item.quantity,
                        url: source.store.host + source.item.url,
                        image_url: source.item.img_url,
                    }
                }
                break;
            case 'CartItemRemove':
                var data = {
                    item: {
                        product_id: source.item.product_id,
                        product_title: source.item.product_name,
                        variant_id: source.item.variant_id,
                        variant_title: source.item.variant_name,
                        collections: source.item.collections.split(',').join(', '),
                        price: source.item.price,
                        quantity: source.item.quantity,
                        url: source.store.host + source.item.url,
                        image_url: source.item.img_url,
                    }
                }
                break;
            case 'CouponAdd':

                var data = {

                    coupon: {

                        code: source.coupon.code

                    }

                }
                break;
            case 'CheckoutInitial':

                var data = {

                    checkout: {

                        item_count: source.checkout.item_count

                    }

                }
                break;
            case 'DeliveryAddressAdd':

                var data = {

                    delivery: {

                        method: source.delivery.method,
                        name: source.delivery.method == 'shipping' ? null : source.delivery.address.name,
                        first_name: source.delivery.address.first_name,
                        last_name: source.delivery.address.last_name,
                        country: source.delivery.address.country,
                        province: source.delivery.address.province,
                        city: source.delivery.address.city,

                    }

                }

                break;
            case 'CheckoutCompleted':

                var items = []

                source.order.order_item.forEach(item => {

                    items.push({

                        order_number: source.order.order_number,
                        product_id: item.product_id,
                        product_title: item.product_name,
                        variant_id: item.variant_id,
                        variant_title: item.variant_name,
                        collections: item.collections.split(',').join(', '),
                        price: item.price,
                        quantity: item.quantity,
                        url: source.store.host + "/products/" + item.handle,
                        image_url: item.item_image.url,

                    })

                });

                var data = {

                    order: {

                        number: source.order.order_number,
                        item_count: source.order.order_item.length,
                        total_amount: source.order.total_amount_include_transaction,
                        transaction: source.order.transaction_records[0],
                        delivery_address: source.order.shipping_address,
                        items: items

                    }

                }

                if (source.order.pickup_location != null) {

                    data.order.delivery_address = source.order.pickup_location;

                }


                break;

            default:
                var data = null;
        }

        return data;
    }

}

class EasyStoreSuperClass {

    constructor() {
        this.Event = new EasyStoreEvents();
    }

}

window.EasyStore = new EasyStoreSuperClass();


// Minify to storefront.min.js using https://jscompress.com/


(function () {
    var engines = [
        ['Google', 'q', /\.google\./],
        ['Yahoo!', 'p', /search\.yahoo\./],
        ['MSN', 'q', /\.msn\./],
        ['Live', 'q', /\.live\./],
        ['AlltheWeb', 'q', /\.alltheweb\./],
        ['AOL', 'query', /\.aol\./],
        ['Ask', 'q', /\.ask\./],
        ['AltaVista', 'q', /\.altavista\./],
        ['BBC', 'q', /\.bbc\./],
        ['HotBot', 'query', /\.hotbot\./],
        ['Lycos', 'query', /\.lycos\./],
        ['Bing', 'q', /bing\./],
        ['Daum', 'q', /\.daum\./],
        ['Eniro', 'search_word', /\.eniro\./],
        ['Naver', 'query', /\.naver\./],
        ['About', 'terms', /\.about\./],
        ['Mamma', 'query', /\.mamma\./],
        ['Alltheweb', 'q', /\.alltheweb\./],
        ['Voila', 'rdata', /\.voila\./],
        ['Baidu', 'wd', /\.baidu\./],
        ['Alice', 'qs', /\.alice\./],
        ['Yandex', 'text', /\.yandex\./],
        ['Search', 'q', /\.search\./],
        ['PCHome', 'q', /\.pchome\./],
        ['Ozu', 'q', /\.ozu\./],
        ['Terra', 'query', /\.terra\./],
        ['Mynet', 'q', /\.mynet\./],
        ['Ekolay', 'q', /\.ekolay\./],
        ['Rambler', 'words', /\.rambler\./]
    ];

    var ref = '';
    var query = '';
    var engine = '';
    // var referrer = (window.decodeURI)?window.decodeURI(document.referrer):document.referrer;
    var referrer = document.referrer;
    var resource = (window.decodeURI) ? window.decodeURI(document.URL) : document.URL;

    function readCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') { c = c.substring(1, c.length); }
            if (c.indexOf(nameEQ) === 0) { return c.substring(nameEQ.length, c.length); }
        }
        return null;
    }

    function setCookie(permanent, cookieName, cookieValue) {
        var increment = (permanent) ? 1000 * 60 * 60 * 24 * 360 * 20 : 1000 * 60 * 30;
        console.log("traffic.js - setCookie", cookieName, cookieValue);
        writeCookie(cookieName, cookieValue, today.getTime() + increment);
    }

    function writeCookie(cookieName, cookieValue, msec_in_utc) {
        var expire = new Date(msec_in_utc);
        document.cookie = cookieName + "=" + escape(cookieValue) + ";path=/" + ";expires=" + expire.toUTCString();
    }

    function readStorage(permanent, cookieName) {
        var storage = permanent ? 'localStorage' : 'sessionStorage';

        if (storage in window) { return window[storage].getItem(cookieName); }
        else { return false; }
    }

    function setStorage(permanent, cookieName, cookieValue) {
        var storage = permanent ? 'localStorage' : 'sessionStorage';
        if (storage in window) { window[storage].setItem(cookieName, cookieValue); }
    }

    function fetch(permanent, cookieName, func) {
        var cookie = readCookie(cookieName);
        if (cookie == 'undefined') {
            cookie = undefined;
        }
        var local = readStorage(permanent, cookieName);
        if (local == 'undefined') {
            local = undefined;
        }
        var cookieValue = cookie || local || func.call();

        if (!cookie || !permanent) { setCookie(permanent, cookieName, cookieValue); }
        if (!local) { setStorage(permanent, cookieName, cookieValue); }

        return cookieValue;
    }

    function uniqueId() {
        return 'xxxxxxxx-8xxx-yxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        }).toUpperCase();
    }

    if (referrer && referrer !== '') {
        if (referrer.match('\:\/\/' + window.location.host + '[^\w]')) {
            ref = '';
        }
        else {
            ref = 'r';
            for (var i = 0; i < engines.length; i++) {
                if (referrer.match(engines[i][2])) {
                    var match = referrer.match(engines[i][1] + '=([^&$]{2,})');
                    if (match) {
                        query = match[1];
                    }
                    engine = engines[i][0];
                    ref = 's';
                }
            }
        }
    }
    else {
        referrer = '';
    }

    var today = new Date();
    var visit = '';
    var uniq = '';
    var uniqToken, visitToken;

    if (window.location.pathname.indexOf("checkout") === -1) {

        if (readCookie('_easystore_visit')) { visit = 1; }
        if (readCookie('_easystore_uniq')) { uniq = 1; }

        // set return visit cookie
        var expire_time_in_msec = today.getTime() + (30 * 60 * 1000); // expire 30 minutes from now 
        writeCookie('_easystore_visit', 't', expire_time_in_msec);

        // set unique visitor cookie - expires tomorrow midnight of the shop's TZ.
        // Today @ midnight + 2years (in msec) - client offset (in msec) (all in UTC)
        var expire_time = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0) + 2 * 365 * 86400 * 1000 + (new Date().getTimezoneOffset() * 60 * 1000);
        writeCookie('_easystore_uniq', 'x', expire_time);

    }

    uniqToken = fetch(true, '_easystore_y', function () { return uniqueId(); });
    visitToken = fetch(false, '_easystore_s', function () { return uniqueId(); });

    setTimeout(function () {
        var req = '/analytics/collect.gif?' +
            'v=' + ref +
            '&e=' + encodeURIComponent(engine) +
            '&p=' + encodeURIComponent('//' + window.location.hostname + window.location.pathname + window.location.search) +
            '&q=' + query +
            '&r=' + encodeURIComponent(referrer) +
            '&vi=' + visit +
            '&uq=' + uniq +
            '&su=' + uniqToken +
            '&sv=' + visitToken +
            '&tu=' + uniqueId();

        new Image().src = req;
    }, 50);

}());

EasyStore.CustomerAddress = {
    toggleForm: function (t) {
        var e = document.getElementById("edit_address_" + t)
            , n = document.getElementById("view_address_" + t);
        return e.style.display = "none" == e.style.display ? "" : "none",
            n.style.display = "none" == n.style.display ? "" : "none",
            !1
    },
    toggleNewForm: function () {
        var t = document.getElementById("add_address");
        return t.style.display = "none" == t.style.display ? "" : "none",
            !1
    },
    destroy: function (t, e) {
        confirm(e || "Are you sure you wish to delete this address?") && EasyStore.postLink("/account/addresses/" + t, {
            parameters: {
                _method: "delete"
            }
        })
    }
};
"undefined" == typeof window.EasyStore && (window.EasyStore = {}), EasyStore.bind = function (t, e) {
    return function () {
        return t.apply(e, arguments)
    }
}, EasyStore.setSelectorByValue = function (t, e) {
    for (var n = 0, r = t.options.length; r > n; n++) {
        var i = t.options[n];
        if (e == i.value || e == i.innerHTML) return t.selectedIndex = n, n
    }
}, EasyStore.addListener = function (t, e, n) {
    t.addEventListener ? t.addEventListener(e, n, !1) : t.attachEvent("on" + e, n)
}, EasyStore.postLink = function (t, e) {
    e = e || {};
    var n = e.method || "post",
        r = e.parameters || {},
        i = document.createElement("form");
    i.setAttribute("method", n), i.setAttribute("action", t);
    for (var o in r) {
        var a = document.createElement("input");
        a.setAttribute("type", "hidden"), a.setAttribute("name", o), a.setAttribute("value", r[o]), i.appendChild(a)
    }
    document.body.appendChild(i), i.submit(), document.body.removeChild(i)
}, EasyStore.CountryProvinceSelector = function (t, e, n) {
    this.countryEl = document.getElementById(t),
        this.provinceEl = document.getElementById(e),
        this.provinceContainer = document.getElementById(n.hideElement || e),
        this.provinceContainer2 = document.getElementById(n.hideElement + '2' || e + '2'),
        this.subDistrictContainer = n.hideElement_sub_district ? document.getElementById(n.hideElement_sub_district) : null,
        this.villageContainer = n.hideElement_village ? document.getElementById(n.hideElement_village) : null,
        EasyStore.addListener(this.countryEl, "change",
            EasyStore.bind(this.countryHandler, this)),
        this.initCountry(),
        this.initProvince()
}, EasyStore.CountryProvinceSelector.prototype = {
    initCountry: function () {
        var t = this.countryEl.getAttribute("data-default");
        EasyStore.setSelectorByValue(this.countryEl, t), this.countryHandler()
    },
    initProvince: function () {
        var t = this.provinceEl.getAttribute("data-default");
        t && this.provinceEl.options.length > 0 && EasyStore.setSelectorByValue(this.provinceEl, t)
    },
    countryHandler: function (t) {
        var e = this.countryEl.options[this.countryEl.selectedIndex],
            n = e.getAttribute("data-provinces"),
            r = JSON.parse(n),
            have_sub_district = ["PH", "ID"],
            have_village = ["ID"];

        if (this.subDistrictContainer) this.subDistrictContainer.style.display = "none";
        if (this.subDistrictContainer && have_sub_district.includes(e.value)) this.subDistrictContainer.style.display = "";

        if (this.villageContainer) this.villageContainer.style.display = "none";
        if (this.villageContainer && have_village.includes(e.value)) this.villageContainer.style.display = "";

        if (this.clearOptions(this.provinceEl), r && 0 == r.length) {
            this.provinceContainer.style.display = "none";
            this.provinceContainer2.style.display = "";
        }
        else {
            for (var i = 0; i < r.length; i++) {
                var e = document.createElement("option");
                e.value = r[i][0], e.innerHTML = r[i][1], this.provinceEl.appendChild(e)
            }
            this.provinceContainer.style.display = "";
            this.provinceContainer2.style.display = "none";
        }
    },
    clearOptions: function (t) {
        for (; t.firstChild;) t.removeChild(t.firstChild)
    },
    setOptions: function (t, e) {
        var n = 0;
        for (e.length; n < e.length; n++) {
            var r = document.createElement("option");
            r.value = e[n], r.innerHTML = e[n], t.appendChild(r)
        }
    }
    };


!function (e) {
    var t = {};
    function i(r) {
        if (t[r])
            return t[r].exports;
        var n = t[r] = {
            i: r,
            l: !1,
            exports: {}
        };
        return e[r].call(n.exports, n, n.exports, i),
            n.l = !0,
            n.exports
    }
    i.m = e,
        i.c = t,
        i.d = function (e, t, r) {
            i.o(e, t) || Object.defineProperty(e, t, {
                enumerable: !0,
                get: r
            })
        }
        ,
        i.r = function (e) {
            "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
                value: "Module"
            }),
                Object.defineProperty(e, "__esModule", {
                    value: !0
                })
        }
        ,
        i.t = function (e, t) {
            if (1 & t && (e = i(e)),
                8 & t)
                return e;
            if (4 & t && "object" == typeof e && e && e.__esModule)
                return e;
            var r = Object.create(null);
            if (i.r(r),
                Object.defineProperty(r, "default", {
                    enumerable: !0,
                    value: e
                }),
                2 & t && "string" != typeof e)
                for (var n in e)
                    i.d(r, n, function (t) {
                        return e[t]
                    }
                        .bind(null, n));
            return r
        }
        ,
        i.n = function (e) {
            var t = e && e.__esModule ? function () {
                return e.default
            }
                : function () {
                    return e
                }
                ;
            return i.d(t, "a", t),
                t
        }
        ,
        i.o = function (e, t) {
            return Object.prototype.hasOwnProperty.call(e, t)
        }
        ,
        i.p = "/",
        i(i.s = 4)
}({
    2703: function (e, t, i) {
        "use strict";
        Object.defineProperty(t, "__esModule", {
            value: !0
        });
        t.default = class {
            constructor() {
                this.currency = {},
                    this.is_server_side_currency_conversion = !1
            }
            init(e, t = !1) {
                for (let t of e)
                    this.currency[t.code] = t,
                        t.is_primary && (this.primary_currency = t.code);
                this.is_server_side_currency_conversion = t,
                    this.current_currency = null == this.getCookie("currency") ? this.primary_currency : this.getCookie("currency"),
                    this.checkValidCurrency(),
                    null == this.getCookie("currency") && this.setCookie(this.current_currency),
                    this.convertAll()
            }
            change(e) {
                this.current_currency = e,
                    this.setCookie(this.current_currency),
                    this.is_server_side_currency_conversion || this.convertAll()
            }
            getCookie(e) {
                var t = document.cookie.match("(^|;) ?" + e + "=([^;]*)(;|$)");
                return t ? t[2] : null
            }
            setCookie(e, t = 365) {
                var i = new Date;
                i.setTime(i.getTime() + 864e5 * t),
                    document.cookie = "currency=" + e + "; path=/; domain=." + window.location.hostname + "; expires=" + i.toGMTString() + ";"
            }
            formatMoney(e) {
                let t = this.convert(Number(e) / 100)
                    , i = this.currency[this.current_currency]
                    , r = t.toFixed(i.format_decimals).toString()
                    , n = null != i.format_prefix ? i.format_prefix + " " : ""
                    , s = null != i.format_suffix ? " " + i.format_suffix : "";
                if (null != i.thousand_separator) {
                    let e = r.split(".");
                    e[0] = e[0].replace(/\B(?=(\d{3})+(?!\d))/g, i.thousand_separator),
                        r = e.join(".")
                }
                return n + r + s
            }
            formatDecimals(e) {
                let t = this.currency[this.current_currency]
                    , i = (Number(e) / 100).toFixed(t.format_decimals).toString();
                if (null != t.thousand_separator) {
                    let e = i.split(".");
                    e[0] = e[0].replace(/\B(?=(\d{3})+(?!\d))/g, t.thousand_separator),
                        i = e.join(".")
                }
                return i
            }
            convertAll() {
                this.checkValidCurrency();
                let e = document.querySelectorAll("span.money");
                for (let t of e)
                    t.innerHTML = this.formatMoney(100 * Number(t.getAttribute("data-ori-price").replace(/,/g, "")))
            }
            convert(e) {
                if (this.is_server_side_currency_conversion)
                    return e;
                var t = this.primary_currency
                    , i = this.current_currency;
                return e / Number(this.currency[t].rate) * Number(this.currency[i].rate)
            }
            checkValidCurrency() {
                null == this.currency[this.current_currency] && (this.current_currency = this.primary_currency,
                    this.setCookie(this.current_currency))
            }
        }
    },
    "3JMI": function (e, t, i) {
        "use strict";
        Object.defineProperty(t, "__esModule", {
            value: !0
        });
        t.default = class {
            constructor() {
                this.selectorDivClass = "selector-wrapper",
                    this.selectorClass = "single-option-selector",
                    this.variantIdFieldIdSuffix = "-variant-id",
                    this.selectorType = "radio",
                    this.variantIdField = null,
                    this.historyState = null,
                    this.selectors = [],
                    this.initDropdown = function () {
                        var e = {
                            initialLoad: !0
                        };
                        if (!this.selectVariantFromDropdown(e)) {
                            var t = this;
                            setTimeout(function () {
                                t.selectVariantFromParams(e) || t.fireOnChangeForFirstDropdown.call(t, e)
                            })
                        }
                    }
                    ,
                    this.fireOnChangeForFirstDropdown = function (e) {
                        this.selectors[0].element.onchange(e)
                    }
                    ,
                    this.selectVariantFromParamsOrDropdown = function (e) {
                        this.selectVariantFromParams(e) || this.selectVariantFromDropdown(e)
                    }
                    ,
                    this.selectVariantFromDropdown = function (e) {
                        var t = document.getElementById(this.domIdPrefix).querySelector("[selected]");
                        if (t || (t = document.getElementById(this.domIdPrefix).querySelector('[selected="selected"]')),
                            !t)
                            return !1;
                        var i = t.value;
                        return this.selectVariant(i, e)
                    }
                    ,
                    this.selectVariantFromParams = function (e) {
                        var t = l.urlParam("variant");
                        return this.selectVariant(t, e)
                    }
                    ,
                    this.selectVariant = function (e, t) {
                        var i = this.product.getVariantById(e);
                        if (null == i)
                            return !1;
                        for (var r = 0; r < this.selectors.length; r++) {
                            var n = this.selectors[r].element
                                , s = i[n.getAttribute("data-option")];
                            null != s && this.optionExistInSelect(n, s) && (n.value = s)
                        }
                        return this.selectors[0].element.onchange(t),
                            !0
                    }
                    ,
                    this.optionExistInSelect = function (e, t) {
                        if ("radio" == this.selectorType || "radio-img" == this.selectorType) {
                            for (var i = 0; i < e.childElementCount; i++)
                                if (e.getElementsByTagName("input")[i].value == t)
                                    return !0
                        } else
                            for (i = 0; i < e.options.length; i++)
                                if (e.options[i].value == t)
                                    return !0
                    }
                    ,
                    this.insertSelectors = function (e, t) {
                        l.isDefined(t) && this.setMessageElement(t),
                            this.domIdPrefix = "product-" + this.product.id + "-variant-selector";
                        var i = document.getElementById(e);
                        l.each(this.buildSelectors(), function (e) {
                            i.appendChild(e)
                        })
                    }
                    ,
                    this.replaceSelector = function (e, t) {
                        var i = document.getElementById(t)
                            , r = i.parentNode;
                        l.each(this.buildSelectors(e), function (e) {
                            r.insertBefore(e, i)
                        }),
                            i.style.display = "none",
                            this.variantIdField = i;
                        var n = document.getElementsByClassName(this.selectorDivClass);
                        if (1 == this.product.options.length && "Title" != this.product.options[0]) {
                            var s = document.createElement("label");
                            if (s.htmlFor = t + "-option-0",
                                s.innerHTML = this.product.options[0],
                                s.className = "form__label",
                                "radio-img" == e) {
                                var o = document.createElement("span");
                                o.className = "label__value",
                                    s.appendChild(o)
                            }
                            document.getElementsByClassName(this.selectorDivClass)[0].prepend(s)
                        }
                        if (1 == this.product.variants.length && this.product.variants[0].title.includes("Default"))
                            for (var a = 0; a < n.length; a++)
                                document.getElementsByClassName(this.selectorDivClass)[a].setAttribute("style", "display:none")
                    }
                    ,
                    this.buildSelectors = function (e) {
                        for (var t = 0; t < this.product.optionNames().length; t++) {
                            if ("radio-img" == e)
                                var i = new s(this, t, this.product.optionNames()[t], this.product.optionValues(t));
                            else
                                "radio" == e ? i = new o(this, t, this.product.optionNames()[t], this.product.optionValues(t)) : "select" == e && (i = new a(this, t, this.product.optionNames()[t], this.product.optionValues(t)));
                            i.element.disabled = !1,
                                this.selectors.push(i)
                        }
                        var r = this.selectorDivClass
                            , n = this.product.optionNames();
                        return l.map(this.selectors, function (t) {
                            var i = document.createElement("div");
                            if (i.setAttribute("class", r),
                                n.length > 1) {
                                var s = document.createElement("label");
                                if (s.htmlFor = t.element.id,
                                    s.innerHTML = t.name,
                                    "radio-img" == e) {
                                    var o = document.createElement("span");
                                    o.className = "label__value",
                                        s.appendChild(o)
                                }
                                i.appendChild(s)
                            }
                            var a = document.createElement("div");
                            return a.classList.add("select", "mb-2"),
                                a.appendChild(t.element),
                                "select" == e ? (i.appendChild(a),
                                    i) : (i.appendChild(t.element),
                                        i)
                        })
                    }
                    ,
                    this.selectedValues = function () {
                        if ("radio" == this.selectorType || "radio-img" == this.selectorType) {
                            for (var e = [], t = 0; t < this.selectors.length; t++)
                                for (var i = !1, r = 0; r < this.selectors[t].element.childElementCount && !i; r++)
                                    if (this.selectors[t].element.getElementsByTagName("input")[r].checked) {
                                        i = !0;
                                        var n = this.selectors[t].element.getElementsByTagName("input")[r].value;
                                        e.push(n)
                                    }
                        } else
                            for (e = [],
                                t = 0; t < this.selectors.length; t++)
                                n = this.selectors[t].element.value,
                                    e.push(n);
                        return e
                    }
                    ,
                    this.updateSelectors = function (e, t) {
                        var i = this.selectedValues()
                            , r = this.product.getVariant(i);
                        r ? (this.variantIdField.disabled = !1,
                            this.variantIdField.value = r.id) : this.variantIdField.disabled = !0,
                            this.onVariantSelected(r, this, t),
                            null != this.historyState && this.historyState.onVariantChange(r, this, t)
                    }
            }
            create(e, t, i) {
                return t && "" != t || (t = "radio"),
                    this.selectorDivClass = "selector-wrapper-" + e,
                    this.selectorClass = "single-option-selector",
                    this.variantIdFieldIdSuffix = "-variant-id",
                    this.variantIdField = null,
                    this.historyState = null,
                    this.selectors = [],
                    this.domIdPrefix = e,
                    this.product = new n(i.product),
                    this.selectorType = t,
                    this.replaceSelector(this.selectorType, e),
                    this.onVariantSelected = l.isDefined(i.onVariantSelected) ? i.onVariantSelected : function () { }
                    ,
                    this.initDropdown(),
                    i.enableHistoryState && (this.historyState = new r(this)),
                    !0
            }
        }
            ;
        class r {
            constructor(e) {
                this.register = function (e) {
                    window.addEventListener("popstate", function (t) {
                        e.selectVariantFromParamsOrDropdown({
                            popStateCall: !0
                        })
                    })
                }
                    ,
                    this.onVariantChange = function (e, t, i) {
                        this.browserSupports() && (!e || i.initialLoad || i.popStateCall || l.setParam("variant", e.id))
                    }
                    ,
                    this.browserSupports = function () {
                        return window.history && window.history.replaceState
                    }
                    ,
                    this.browserSupports() && this.register(e)
            }
        }
        class n {
            constructor(e) {
                this.optionNames = function () {
                    return "Array" == l.getClass(this.options) ? this.options : []
                }
                    ,
                    this.optionValues = function (e) {
                        if (!l.isDefined(this.variants))
                            return null;
                        var t = l.map(this.variants, function (t) {
                            var i = "option" + (e + 1);
                            return null == t[i] ? null : t[i]
                        });
                        return null == t[0] ? null : l.uniq(t)
                    }
                    ,
                    this.getVariant = function (e) {
                        var t = null;
                        return e.length != this.options.length ? t : (l.each(this.variants, function (i) {
                            for (var r = !0, n = 0; n < e.length; n++) {
                                i["option" + (n + 1)] != e[n] && (r = !1)
                            }
                            return 1 == r ? void (t = i) : void 0
                        }),
                            t)
                    }
                    ,
                    this.getVariantById = function (e) {
                        for (var t = 0; t < this.variants.length; t++) {
                            var i = this.variants[t];
                            if (e == i.id)
                                return i
                        }
                        return null
                    }
                    ,
                    l.isDefined(e) && this.update(e)
            }
            update(e) {
                for (var t in e)
                    this[t] = e[t]
            }
        }
        function s(e, t, i, r) {
            this.multiSelector = e,
                this.values = r,
                this.index = t,
                this.name = i,
                this.element = document.createElement("fieldset"),
                this.element.setAttribute("data-selector-type", "radio");
            let n = this.multiSelector.product.first_available_variant || null;
            for (var s = 0; s < r.length; s++) {
                var o = document.createElement("input");
                if (o.setAttribute("type", "radio"),
                    o.setAttribute("name", i),
                    o.id = e.domIdPrefix + "-option-" + t + "-tag-" + s,
                    (null == n && 0 == s || null != n && n.options[this.index] == r[s]) && o.setAttribute("checked", "checked"),
                    o.value = r[s],
                    this.element.appendChild(o),
                    this.label = document.createElement("label"),
                    0 == this.index) {
                    let e = this.multiSelector.product.variants.find(e => e[`option${this.index + 1}`] == r[s] && null !== e.featured_image)
                        , t = e && e.featured_image.is_variant_image ? e.featured_image.src : null;
                    if (t) {
                        var a = document.createElement("img");
                        a.className = "variant-img-label",
                            a.src = t,
                            this.label.appendChild(a),
                            this.element.setAttribute("data-selector-type", "radio-img")
                    }
                    this.label.className = "variant-img-label-wrapper"
                }
                var l = document.createElement("span");
                l.className = "label__text",
                    l.innerHTML = r[s],
                    this.label.appendChild(l),
                    this.label.setAttribute("for", e.domIdPrefix + "-option-" + t + "-tag-" + s),
                    this.element.appendChild(this.label)
            }
            return this.element.setAttribute("name", i),
                this.element.setAttribute("class", this.multiSelector.selectorClass + " product-form__input"),
                this.element.setAttribute("data-option", "option" + (t + 1)),
                this.element.id = e.domIdPrefix + "-option-" + t,
                this.element.onchange = function (i, r) {
                    r = r || {},
                        e.updateSelectors(t, r)
                }
                ,
                !0
        }
        function o(e, t, i, r) {
            this.multiSelector = e,
                this.values = r,
                this.index = t,
                this.name = i,
                this.element = document.createElement("fieldset");
            let n = this.multiSelector.product.first_available_variant || null;
            for (var s = 0; s < r.length; s++) {
                var o = document.createElement("input");
                o.setAttribute("type", "radio"),
                    o.setAttribute("name", i),
                    o.id = e.domIdPrefix + "-option-" + t + "-tag-" + s,
                    (null == n && 0 == s || null != n && n.options[this.index] == r[s]) && o.setAttribute("checked", "checked"),
                    o.value = r[s],
                    this.element.appendChild(o),
                    this.label = document.createElement("label"),
                    this.label.innerHTML = r[s],
                    this.label.setAttribute("for", e.domIdPrefix + "-option-" + t + "-tag-" + s),
                    this.element.appendChild(this.label)
            }
            return this.element.setAttribute("name", i),
                this.element.setAttribute("class", this.multiSelector.selectorClass + " product-form__input"),
                this.element.setAttribute("data-option", "option" + (t + 1)),
                this.element.id = e.domIdPrefix + "-option-" + t,
                this.element.onchange = function (i, r) {
                    r = r || {},
                        e.updateSelectors(t, r)
                }
                ,
                !0
        }
        function a(e, t, i, r) {
            this.multiSelector = e,
                this.values = r,
                this.index = t,
                this.name = i,
                this.element = document.createElement("select");
            let n = this.multiSelector.product.first_available_variant || null;
            for (var s = 0; s < r.length; s++) {
                var o = document.createElement("option");
                o.value = r[s],
                    o.innerHTML = r[s],
                    this.element.appendChild(o),
                    (null == n && 0 == s || null != n && n.options[this.index] == r[s]) && o.setAttribute("selected", "selected")
            }
            return this.element.setAttribute("class", this.multiSelector.selectorClass + " select__select"),
                this.element.setAttribute("data-option", "option" + (t + 1)),
                this.element.id = e.domIdPrefix + "-option-" + t,
                this.element.onchange = function (i, r) {
                    r = r || {},
                        e.updateSelectors(t, r)
                }
                ,
                !0
        }
        var l = {
            each: function (e, t) {
                for (var i = 0; i < e.length; i++)
                    t(e[i], i)
            },
            map: function (e, t) {
                for (var i = [], r = 0; r < e.length; r++)
                    i.push(t(e[r], r));
                return i
            },
            arrayIncludes: function (e, t) {
                for (var i = 0; i < e.length; i++)
                    if (e[i] == t)
                        return !0;
                return !1
            },
            uniq: function (e) {
                for (var t = [], i = 0; i < e.length; i++)
                    l.arrayIncludes(t, e[i]) || t.push(e[i]);
                return t
            },
            isDefined: function (e) {
                return void 0 !== e
            },
            getClass: function (e) {
                return Object.prototype.toString.call(e).slice(8, -1)
            },
            extend: function (e, t) {
                function i() { }
                i.prototype = t.prototype,
                    e.prototype = new i,
                    e.prototype.constructor = e,
                    e.baseConstructor = t,
                    e.superClass = t.prototype
            },
            locationSearch: function () {
                return window.location.search
            },
            locationHash: function () {
                return window.location.hash
            },
            replaceState: function (e) {
                window.history.replaceState({}, document.title, e)
            },
            urlParam: function (e) {
                var t = RegExp("[?&]" + e + "=([^&#]*)").exec(this.locationSearch());
                return t && decodeURIComponent(t[1].replace(/\+/g, " "))
            },
            newState: function (e, t) {
                return (this.urlParam(e) ? this.locationSearch().replace(RegExp("(" + e + "=)[^&#]+"), "$1" + t) : "" === this.locationSearch() ? "?" + e + "=" + t : this.locationSearch() + "&" + e + "=" + t) + this.locationHash()
            },
            setParam: function (e, t) {
                this.replaceState(this.newState(e, t))
            }
        }
    },
    4: function (e, t, i) {
        e.exports = i("hEMn")
    },
    DsGA: function (e, t, i) {
        "use strict";
        Object.defineProperty(t, "__esModule", {
            value: !0
        });
        t.default = class {
            constructor() {
                this.headers = {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest"
                }
            }
            addToCart(e, t) {
                fetch("/cart/add?retrieve=true", {
                    method: "POST",
                    headers: this.headers,
                    body: JSON.stringify(e)
                }).then(e => e.json()).then(e => {
                    window.__latest_cart = e,
                        null != e.items && e.items.length > 0 && window.EasyStore.Event.dispatch("carts/item_added", {
                            cart: e
                        }),
                        t(e)
                }
                ).catch(e => {
                    t(e)
                }
                )
            }
            retrieveCart(e) {
                fetch("/new_cart", {
                    method: "GET",
                    headers: this.headers
                }).then(e => e.json()).then(t => {
                    window.__latest_cart = t,
                        window.EasyStore.Event.dispatch("carts/viewed", {
                            cart: t
                        }),
                        e(t)
                }
                ).catch(t => {
                    e(t)
                }
                )
            }
            updateCart(e, t) {
                fetch("/new_cart/update", {
                    method: "PUT",
                    headers: this.headers,
                    body: JSON.stringify(e)
                }).then(e => e.json()).then(e => {
                    t(e)
                }
                ).catch(e => {
                    t(e)
                }
                )
            }
            removeCartItem(e, t) {
                fetch("/cart/remove_item_quantity", {
                    method: "POST",
                    headers: this.headers,
                    body: JSON.stringify(e)
                }).then(e => e.json()).then(e => {
                    window.__latest_cart = e,
                        window.EasyStore.Event.dispatch("carts/item_removed", {
                            cart: e
                        }),
                        t(e)
                }
                ).catch(e => {
                    t(e)
                }
                )
            }
            updateVoucher(e, t, i) {
                let r = {};
                r.category = e,
                    r["create" == e ? "voucher_code" : "order_discount_id"] = t,
                    fetch("/new_cart/voucher", {
                        method: "create" == e ? "POST" : "DELETE",
                        headers: this.headers,
                        body: JSON.stringify(r)
                    }).then(e => e.json()).then(function (e) {
                        i(e)
                    }).catch(e => {
                        i(e)
                    }
                    )
            }
            getRecommendProducts(e, t) {
                fetch(e + "/recommend", {
                    method: "GET",
                    headers: this.headers
                }).then(e => e.json()).then(e => {
                    t(e)
                }
                )
            }
        }
    },
    Vyj8: function (e, t, i) {
        "use strict";
        Object.defineProperty(t, "__esModule", {
            value: !0
        });
        t.default = class {
            constructor(e, t, i) {
                this.countryEl = document.getElementById(e),
                    this.provinceEl = document.getElementById(t),
                    this.provinceContainer = document.getElementById(i.hideElement || t),
                    this.provinceContainer2 = document.getElementById(i.hideElement + "2" || !1),
                    this.countryEl.addEventListener("change", () => {
                        this.countryHandler()
                    }
                    ),
                    this.initCountry(),
                    this.initProvince()
            }
            countryHandler() {
                let e = this.countryEl.options[this.countryEl.selectedIndex].getAttribute("data-provinces")
                    , t = JSON.parse(e);
                if (this.clearOptions(this.provinceEl),
                    t && 0 == t.length)
                    this.provinceContainer.style.display = "none",
                        this.provinceContainer2.style.display = "";
                else {
                    for (let e = 0; e < t.length; e++) {
                        let i = document.createElement("option");
                        i.value = t[e][0],
                            i.innerHTML = t[e][1],
                            this.provinceEl.appendChild(i)
                    }
                    this.provinceContainer.style.display = "",
                        this.provinceContainer2.style.display = "none"
                }
            }
            clearOptions(e) {
                for (; e.firstChild;)
                    e.removeChild(e.firstChild)
            }
            initCountry() {
                var e = this.countryEl.getAttribute("data-default");
                this.setSelectorByValue(this.countryEl, e),
                    this.countryHandler()
            }
            initProvince() {
                var e = this.provinceEl.getAttribute("data-default");
                e && this.provinceEl.options.length > 0 && this.setSelectorByValue(this.provinceEl, e)
            }
            setSelectorByValue(e, t) {
                for (var i = 0, r = e.options.length; r > i; i++) {
                    var n = e.options[i];
                    if (t == n.value || t == n.innerHTML)
                        return e.selectedIndex = i,
                            i
                }
            }
            setOptions(e, t) {
                var i = 0;
                for (t.length; i < t.length; i++) {
                    var r = document.createElement("option");
                    r.value = t[i],
                        r.innerHTML = t[i],
                        e.appendChild(r)
                }
            }
        }
    },
    hEMn: function (e, t, i) {
        "use strict";
        Object.defineProperty(t, "__esModule", {
            value: !0
        });
        const r = i("DsGA")
            , n = i("3JMI")
            , s = i("2703")
            , o = i("Vyj8");
        window.__latest_cart = window.__latest_cart || null,
            window.EasyStore = window.EasyStore || {},
            window.EasyStore.Action = new r.default,
            window.EasyStore.Currencies = new s.default,
            window.EasyStore.OptionSelectorsNew = new n.default,
            window.EasyStore.OptionSelectors = class extends n.default {
                constructor(e, t, i) {
                    super(),
                        this.create(e, t, i)
                }
            }
            ,
            window.EasyStore.Address = window.EasyStore.Address || {},
            window.EasyStore.Address.provinceSelector = o.default
    }
});


$(function () {
    var is_top_enabled = 0;

    const loadScript = function (url, callback) {
        const script = document.createElement("script");
        script.type = "text/javascript";
        // If the browser is Internet Explorer.
        if (script.readyState) {
            script.onreadystatechange = function () {
                if (script.readyState == "loaded" || script.readyState == "complete") {
                    script.onreadystatechange = null;
                    callback();
                }
            };
            // For any other browser.
        } else {
            script.onload = function () {
                callback();
            };
        }
        script.src = url;
        document.getElementsByTagName("head")[0].appendChild(script);
    };

    const announcementBarAppJS = function ($) {

        $('#announcement-close-button').on('click', function () {
            $('#announcement-bar, #announcement-bar-top').hide();
            $('#easystore-section-header, .sticky-topbar').css('top', '');
        });
    }

    if (typeof jQuery === 'undefined') {
        loadScript('//ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js', function () {
            jQuery = jQuery.noConflict(true);
            announcementBarAppJS(jQuery);
        });
    } else {
        announcementBarAppJS(jQuery);
    }



    if (is_top_enabled) {
        // Prevent announcement bar block header
        setTimeout(() => {
            $('#easystore-section-header, .sticky-topbar').css('top', $('#announcement-bar').height() + 'px');
        }, 2000);
    }
});

setInterval(function () {
    const total_announcement = "1"
    var total_announcement_left = $("#total_announcement_left").val();

    for (let i = 0; i <= total_announcement; i++) {
        const startDate = new Date();
        const endDateStr = $("#expired_at_" + i).val();
        const endDate = endDateStr == undefined ? new Date() : new Date(endDateStr.replace(/-/g, "/"));
        const seconds = (endDate.getTime() - startDate.getTime()) / 1000;

        const days = parseInt(seconds / 86400);
        const hours = parseInt((seconds % 86400) / 3600);
        const mins = parseInt((seconds % 86400 % 3600) / 60);
        const secs = parseInt((seconds % 86400 % 3600) % 60);

        // use to translate countdown unit
        // (translate based on the preferred language when save announcement bar setting)
        String.prototype.translate = function () {
            try {
                if ($("#locale").val() == "zh_TW") {
                    if (this.toString() === 'day') {
                        return "天";
                    }
                    if (this.toString() === 'hour') {
                        return "小時";
                    }
                    if (this.toString() === 'min') {
                        return "分鐘";
                    }
                    if (this.toString() === 'sec') {
                        return "秒";
                    }
                } else {
                    if (this.toString() === 'day') {
                        if (days > 0) {
                            return "Days";
                        } else {
                            return "Day";
                        }
                    } else if (this.toString() === 'hour') {
                        if (hours > 0) {
                            return "Hours";
                        } else {
                            return "Hour";
                        }
                    } else if (this.toString() === 'min') {
                        if (mins > 0) {
                            return "Mins";
                        } else {
                            return "Min";
                        }
                    } else if (this.toString() === 'sec') {
                        if (secs > 0) {
                            return "Secs";
                        } else {
                            return "Sec";
                        }
                    }
                }
            } catch (error) {
                console.log("Some errors heres", error);
            }
        };

        const announcementBar_countdown = document.getElementById("announcementBar_countdown_" + i);
        if (announcementBar_countdown && seconds > 0) {

            $(announcementBar_countdown).show()
            announcementBar_countdown.innerHTML = `
          <div>
            ${days} <small>${'day'.translate()}</small>
          </div>
          <div>
            ${hours} <small>${'hour'.translate()}</small>
          </div>
          <div>
            ${mins} <small>${'min'.translate()}</small>
          </div>
          <div>
            ${secs} <small>${'sec'.translate()}</small>
          </div>
        `;


        } else if (announcementBar_countdown && seconds <= 0) {
            $("#announcement_bar_" + i).remove();
            total_announcement_left = total_announcement_left - 1;
            $("#total_announcement_left").val(total_announcement_left);
        }
    }

    showOrHide(total_announcement_left);
}, 1000);


function showOrHide(total_announcement_left) {
    if (total_announcement_left <= 1) {
        $("#previous-announcement-bar-button,#next-announcement-bar-button").hide();
    } else {
        $("#previous-announcement-bar-button,#next-announcement-bar-button").show();
    }

    if (total_announcement_left == 0) {
        $("#announcement-close-button").hide();
        $("#announcement-bar").hide();
        $('#announcement-bar-top').hide();
    }
};

let annoucementBarAutoMoveInterval = '';
class AnnouncementBarAppSlider extends HTMLElement {
    constructor() {
        super();
        this.slider = this.querySelector('ul');
        this.sliderItems = this.querySelectorAll('li');
        this.prevButton = this.querySelector('a[name="previous"]');
        this.nextButton = this.querySelector('a[name="next"]');

        if (!this.slider || !this.nextButton) return;

        const resizeObserver = new ResizeObserver(entries => this.initPages());
        resizeObserver.observe(this.slider);

        this.slider.addEventListener('scroll', this.update.bind(this));
        this.prevButton.addEventListener('click', this.onButtonClick.bind(this));
        this.nextButton.addEventListener('click', this.onButtonClick.bind(this));


    }

    initPages() {
        const sliderItemsToShow = Array.from(this.sliderItems).filter(element => element.clientWidth > 0);
        this.sliderLastItem = sliderItemsToShow[sliderItemsToShow.length - 1];
        if (sliderItemsToShow.length === 0) return;
        this.slidesPerPage = Math.floor(this.slider.clientWidth / sliderItemsToShow[0].clientWidth);
        this.totalPages = sliderItemsToShow.length - this.slidesPerPage + 1;
        this.update();
        let self = this
        var total_announcement_left = $("#total_announcement_left").val();
        annoucementBarAutoMoveInterval = setInterval(function () {
            if (total_announcement_left > 1) {
                self.moveSlide('next')
            }
        }, 5000)
    }

    update() {
        this.currentPage = Math.round(this.slider.scrollLeft / this.sliderLastItem.clientWidth) + 1;
    }

    onButtonClick(event) {
        event.preventDefault();
        let self = this;
        self.moveSlide(event.currentTarget.name);
    }


    moveSlide(move_to) {

        clearInterval(annoucementBarAutoMoveInterval);
        let self = this;
        annoucementBarAutoMoveInterval = setInterval(function () {
            self.moveSlide('next');
        }, 5000)

        if (move_to === 'previous' && this.currentPage === 1) {
            this.slider.scrollTo({
                left: this.sliderLastItem.clientWidth * (this.totalPages - 1)
            });
        } else if (move_to === 'next' && this.currentPage === this.totalPages) {
            this.slider.scrollTo({
                left: 0
            });
        } else {
            const slideScrollPosition = move_to === 'next' ? this.slider.scrollLeft + this.sliderLastItem
                .clientWidth : this.slider.scrollLeft - this.sliderLastItem.clientWidth;
            this.slider.scrollTo({
                left: slideScrollPosition
            });
        }
    }

}

customElements.define('slider-announcement-bar-app', AnnouncementBarAppSlider);


// Get references to the radio buttons and the #register-tos div
const registerRadio = document.getElementById('tab-register');
const loginRadio = document.getElementById('tab-login');
const registerTosDiv = document.getElementById('register-tos');

// Function to toggle the visibility of #register-tos
function toggleRegisterTos() {
    if (registerRadio.checked) {
        registerTosDiv.style.display = 'block'; // Show the div
    } else {
        registerTosDiv.style.display = 'none'; // Hide the div
    }
}

// Attach event listeners to the radio buttons
registerRadio.addEventListener('change', toggleRegisterTos);
loginRadio.addEventListener('change', toggleRegisterTos);

// Initial state check
toggleRegisterTos();



// Find the icon inside the close button
const closeButtonIcon = document.querySelector('.modal__close-button .icon');

// Find the modal element
const modal = document.querySelector('#search_modal');
const overlay = document.querySelector('.modal-overlay');
// Add an event listener for the click
if (closeButtonIcon) {
    closeButtonIcon.addEventListener('click', function () {
        // Hide the modal when the icon is clicked
        if (modal) {
            modal.style.display = 'none';
            overlay.style.display = 'none';  // You can use 'none' to hide the modal
        }
    });
}



//// Find the icon inside the close button
//const closeButtonIcon1 = document.querySelector('.modal__toggle-open');

//// Find the modal element
//const modal1 = document.querySelector('#search_modal');
//const overlay1 = document.querySelector('.modal-overlay');
//// Add an event listener for the click
//if (closeButtonIcon1) {
//    closeButtonIcon1.addEventListener('click', function () {
//        // Hide the modal when the icon is clicked
//        if (modal1) {
//            modal1.style.display = 'block';
//            overlay1.style.display = 'block';  // You can use 'none' to hide the modal
//        }
//    });
//}


