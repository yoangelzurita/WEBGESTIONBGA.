// --- CONFIGURACIÓN Y ESTADO ---
const DB_KEY = 'inventario_multi_v1';
const RATE_KEY = 'tasa_cambio_v1';
const DEBTORS_KEY = 'deudas_pendientes_v1';
let products = [];
let debtors = []; 
let currentRate = 40.00;
let html5QrcodeScanner = null;
let scanMode = null;
let isScanning = false;
let cart = {}; 
let currentDebtorId = null;

// --- INICIO Y CARGA DE DATOS ---
document.addEventListener('DOMContentLoaded', () => {
    // Cargar Tasa
    const storedRate = localStorage.getItem(RATE_KEY);
    if(storedRate) {
        currentRate = parseFloat(storedRate);
        document.getElementById('exchangeRate').value = currentRate.toFixed(2);
    }
    // Cargar Productos
    const storedProds = localStorage.getItem(DB_KEY);
    if(storedProds) products = JSON.parse(storedProds);
    
    // Cargar Deudores
    const storedDebtors = localStorage.getItem(DEBTORS_KEY);
    if(storedDebtors) debtors = JSON.parse(storedDebtors);

    renderProducts();
    renderDebtors();

    document.getElementById('searchInput').addEventListener('keyup', (e) => renderProducts(e.target.value));
    
    showSection('inventory');
});

// --- FUNCIONES UTILITARIAS Y DE UI ---

window.showToast = function(message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    container.appendChild(toast);
    
    void toast.offsetWidth;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            container.removeChild(toast);
        }, { once: true });
    }, 3000); 
}

window.showSection = function(sectionId) {
    // Esconder/Desactivar todo
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active-section'));
    document.getElementById('inventorySearch').classList.remove('active');
    document.getElementById('navInventory').classList.remove('active');
    document.getElementById('navDebts').classList.remove('active');

    // Mostrar/Activar la sección correcta
    document.getElementById(sectionId + 'Section').classList.add('active-section');

    if (sectionId === 'inventory') {
        document.getElementById('inventorySearch').classList.add('active');
        document.getElementById('navInventory').classList.add('active');
        document.getElementById('mainTitle').textContent = 'Inventario';
    } else if (sectionId === 'debts') {
        document.getElementById('navDebts').classList.add('active');
        document.getElementById('mainTitle').textContent = 'Deudas Pendientes';
        renderDebtors(); 
    }
}

window.openModal = function(id) { document.getElementById(id).classList.add('active'); }
window.closeModal = function(id) { document.getElementById(id).classList.remove('active'); }

/** NUEVA: Abre un modal de confirmación personalizado */
window.openConfirmationModal = function(title, message, callback, arg = null) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    
    const confirmBtn = document.getElementById('confirmActionBtn');
    
    // Clonar y reemplazar el botón para eliminar escuchadores de eventos antiguos
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    // Asignar el nuevo manejador de eventos
    newConfirmBtn.onclick = function() {
        closeModal('confirmationModal');
        // Ejecutar la función de confirmación con el argumento, si existe
        if (arg !== null) {
            callback(arg);
        } else {
            callback();
        }
    };

    openModal('confirmationModal');
}


// --- LÓGICA DE INVENTARIO Y EDICIÓN ---

window.updateRate = function(val) {
    currentRate = parseFloat(val);
    localStorage.setItem(RATE_KEY, currentRate);
    renderProducts(); 
    renderCart();
    renderDebtors();
    calculateBsPrice();
    showToast("Tasa de cambio actualizada a Bs. " + currentRate.toFixed(2));
}

window.calculateBsPrice = function() {
    const priceUSD = parseFloat(document.getElementById('prodPrice').value);
    const displayElement = document.getElementById('displayBsPrice');
    
    if (!isNaN(priceUSD) && priceUSD > 0) {
        const priceBs = priceUSD * currentRate;
        displayElement.textContent = priceBs.toFixed(2);
    } else {
        displayElement.textContent = '0.00';
    }
}

window.resetProductForm = function() {
    document.getElementById('prodId').value = '';
    document.getElementById('productModalTitle').textContent = 'Nuevo Producto';
    document.getElementById('prodCode').value = '';
    document.getElementById('prodName').value = '';
    document.getElementById('prodPrice').value = '';
    document.getElementById('prodImgBase64').value = '';
    document.getElementById('previewImg').src = '';
    document.getElementById('previewImg').style.display = 'none';
    document.getElementById('displayBsPrice').textContent = '0.00';
}

window.openProductModal = function(productId = null) {
    resetProductForm();
    
    if (productId) {
        const product = products.find(p => p.id === productId);
        if (product) {
            document.getElementById('productModalTitle').textContent = 'Editar Producto';
            document.getElementById('prodId').value = product.id;
            document.getElementById('prodCode').value = product.code;
            document.getElementById('prodName').value = product.name;
            document.getElementById('prodPrice').value = product.priceUSD;
            document.getElementById('prodImgBase64').value = product.image;
            calculateBsPrice(); 
            
            if (product.image) {
                document.getElementById('previewImg').src = product.image;
                document.getElementById('previewImg').style.display = 'block';
            }
        }
    }
    openModal('productModal');
}


window.saveProduct = function(e) {
    e.preventDefault();
    const id = document.getElementById('prodId').value;
    const code = document.getElementById('prodCode').value.trim();
    const name = document.getElementById('prodName').value;
    const priceUSD = parseFloat(document.getElementById('prodPrice').value);
    const image = document.getElementById('prodImgBase64').value;
    
    if (code && products.some(p => p.code === code && p.id != id)) {
        showToast("⚠️ Ese código ya existe.");
        return;
    }

    if (id) {
        const index = products.findIndex(p => p.id == id);
        if (index !== -1) {
            products[index] = { id: parseInt(id), code, name, priceUSD, image };
            showToast("✅ Producto Actualizado");
        }
    } else {
        const newProd = {
            id: Date.now(),
            code,
            name,
            priceUSD,
            image
        };
        products.unshift(newProd);
        showToast("✅ Producto Guardado");
    }

    try {
        localStorage.setItem(DB_KEY, JSON.stringify(products));
    } catch(e) { showToast("Memoria llena"); }
    
    renderProducts();
    closeModal('productModal');
    resetProductForm();
}

/** NUEVA: Función que se ejecuta tras la confirmación del modal */
window.deleteProductConfirmed = function(id) {
    products = products.filter(p => p.id !== id);
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(products));
    } catch(e) { showToast("Memoria llena"); }
    renderProducts();
    showToast("🗑️ Producto Eliminado");
}

/** REEMPLAZO: Llama al modal de confirmación en lugar de confirm() */
window.deleteProduct = function(id) {
    const product = products.find(p => p.id === id);
    openConfirmationModal(
        'Eliminar Producto', 
        `¿Estás seguro de eliminar "${product.name}"?`, 
        deleteProductConfirmed, 
        id
    );
}

// --- RENDERIZADO DE PRODUCTOS ---
window.renderProducts = function(filter = '') {
    const container = document.getElementById('productList');
    const empty = document.getElementById('emptyState');
    container.innerHTML = '';
    
    const term = filter.toLowerCase();
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(term) || 
        (p.code && p.code.toLowerCase().includes(term))
    );

    if (filtered.length === 0) {
        empty.style.display = 'block'; return;
    }
    empty.style.display = 'none';

    filtered.forEach(p => {
        const priceBs = (p.priceUSD * currentRate).toFixed(2);
        const img = p.image || 'https://via.placeholder.com/150?text=IMG';
        const cartQty = cart[p.id] || 0;
        
        const html = `
            <div class="card">
                <div class="card-img-container">
                    <img src="${img}" class="card-img">
                    <div class="card-actions-top"> 
                        <button class="action-btn edit-btn" onclick="openProductModal(${p.id})"><span class="material-icons" style="font-size: 18px;">edit</span></button>
                        <button class="action-btn delete-btn" onclick="deleteProduct(${p.id})"><span class="material-icons" style="font-size: 18px;">delete</span></button>
                    </div>
                    ${cartQty > 0 ? `<div class="cart-indicator">${cartQty}</div>` : ''}
                </div>
                <div class="card-content">
                    <div class="card-title">${p.name}</div>
                    ${p.code ? `<div class="card-code">${p.code}</div>` : ''}
                    
                    <div class="price-box">
                        <div class="price-usd">$${p.priceUSD.toFixed(2)}</div>
                        <div class="price-bs">Bs. ${priceBs}</div>
                    </div>
                    <button class="btn-add-to-cart" onclick="addToCart(${p.id})">🛒 Añadir</button>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// --- LÓGICA DEL CARRITO ---
window.addToCart = function(productId) {
    if (cart[productId]) {
        cart[productId]++;
    } else {
        cart[productId] = 1;
    }
    renderProducts(document.getElementById('searchInput').value);
    showToast(`🛒 Agregado: ${products.find(p => p.id === productId).name}`);
}

/** NUEVA: Función que se ejecuta tras la confirmación de vaciar carrito */
window.clearCartConfirmed = function() {
    cart = {};
    renderCart();
    closeModal('cartModal');
    renderProducts(document.getElementById('searchInput').value);
    showToast("🧹 Carrito vaciado.");
}

/** REEMPLAZO: Ya no usa confirm() nativo */
window.clearCart = function() {
    // La llamada al modal de confirmación se hace ahora desde index.html, 
    // pero si se llamara directamente desde aquí sería:
    // openConfirmationModal('Vaciar Carrito', '¿Estás seguro de vaciar el carrito?', clearCartConfirmed);
    // Para simplificar, la dejaremos en el HTML como está ahora.
}

window.renderCart = function() {
    const itemsContainer = document.getElementById('cartItems');
    const totalUSDElement = document.getElementById('cartTotalUSD');
    const totalBSElement = document.getElementById('cartTotalBS');
    let totalUSD = 0;
    let itemsHTML = '';

    const cartProductIDs = Object.keys(cart).filter(id => cart[id] > 0);
    
    if (cartProductIDs.length === 0) {
        itemsHTML = '<p style="text-align: center; color: #6B7280; padding: 20px;">El carrito está vacío.</p>';
    } else {
        cartProductIDs.forEach(idStr => {
            const id = parseInt(idStr);
            const product = products.find(p => p.id === id);
            if (product) {
                const quantity = cart[idStr];
                const itemTotalUSD = product.priceUSD * quantity;
                totalUSD += itemTotalUSD;

                itemsHTML += `
                    <div class="cart-item">
                        <span>${quantity}x ${product.name}</span>
                        <span class="cart-price">$${itemTotalUSD.toFixed(2)}</span>
                    </div>
                `;
            }
        });
    }

    const totalBS = totalUSD * currentRate;

    itemsContainer.innerHTML = itemsHTML;
    totalUSDElement.textContent = `$${totalUSD.toFixed(2)}`;
    totalBSElement.textContent = `Bs. ${totalBS.toFixed(2)}`;
}

window.openCartModal = function() {
    renderCart();
    openModal('cartModal');
}


// --- LÓGICA DE DEUDAS ---
window.saveDebtor = function(e) {
    e.preventDefault();
    const name = document.getElementById('debtorName').value.trim();

    if (!name) return;

    const newDebtor = {
        id: Date.now(),
        name: name,
        items: {} 
    };

    debtors.push(newDebtor);
    localStorage.setItem(DEBTORS_KEY, JSON.stringify(debtors));
    
    renderDebtors();
    closeModal('debtorModal');
    e.target.reset();
    showToast(`👤 Deudor ${name} agregado.`);
}

/** NUEVA: Función que se ejecuta tras la confirmación de eliminar deudor */
window.deleteDebtorConfirmed = function(id) {
    debtors = debtors.filter(d => d.id !== id);
    localStorage.setItem(DEBTORS_KEY, JSON.stringify(debtors));
    renderDebtors();
    showToast("🗑️ Deuda eliminada.");
}

/** REEMPLAZO: Llama al modal de confirmación en lugar de confirm() */
window.deleteDebtor = function(id) {
    const debtor = debtors.find(d => d.id === id);
    openConfirmationModal(
        'Eliminar Deuda', 
        `¿Estás seguro de eliminar toda la deuda de ${debtor.name}?`, 
        deleteDebtorConfirmed, 
        id
    );
}

window.openDebtItemsModal = function(debtorId) {
    currentDebtorId = debtorId;
    const debtor = debtors.find(d => d.id === debtorId);
    
    if (!debtor) return;

    document.getElementById('currentDebtorName').textContent = debtor.name;
    
    const itemsContainer = document.getElementById('debtItemsContent');
    itemsContainer.innerHTML = '';

    // Renderiza la lista de productos del INVENTARIO para agregar
    products.forEach(p => {
        const currentQty = debtor.items[p.id] || 0;

        const html = `
            <div class="product-list-item">
                <span class="product-info">${p.name} ($${p.priceUSD.toFixed(2)})</span>
                <div class="item-quantity-controls">
                    <button onclick="updateDebtorItem(${debtor.id}, ${p.id}, -1)">-</button>
                    <span id="debtQty-${debtor.id}-${p.id}" style="width: 20px; text-align: center;">${currentQty}</span>
                    <button onclick="updateDebtorItem(${debtor.id}, ${p.id}, 1)">+</button>
                </div>
            </div>
        `;
        itemsContainer.innerHTML += html;
    });

    openModal('debtItemsModal');
}

window.updateDebtorItem = function(debtorId, productId, change) {
    const debtor = debtors.find(d => d.id === debtorId);
    if (!debtor) return;

    const currentQty = debtor.items[productId] || 0;
    let newQty = currentQty + change;

    if (newQty < 0) newQty = 0;

    if (newQty === 0) {
        delete debtor.items[productId];
    } else {
        debtor.items[productId] = newQty;
    }
    
    localStorage.setItem(DEBTORS_KEY, JSON.stringify(debtors));
    
    // Actualizar la vista del modal
    document.getElementById(`debtQty-${debtorId}-${productId}`).textContent = newQty;

    // Actualizar la vista de la lista de deudores (mini-factura)
    renderDebtors();
}


window.renderDebtors = function() {
    const container = document.getElementById('debtorsList');
    const empty = document.getElementById('emptyDebts');
    container.innerHTML = '';

    if (debtors.length === 0) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    debtors.forEach(d => {
        let itemsHTML = '';
        let totalUSD = 0;
        
        const debtorItemIDs = Object.keys(d.items);

        if (debtorItemIDs.length === 0) {
            itemsHTML = '<p style="text-align: center; color: #9CA3AF; padding: 10px;">Aún no hay productos en esta deuda.</p>';
        } else {
            debtorItemIDs.forEach(prodIdStr => {
                const productId = parseInt(prodIdStr);
                const quantity = d.items[prodIdStr];
                const product = products.find(p => p.id === productId);

                if (product) {
                    const itemTotalUSD = product.priceUSD * quantity;
                    const itemTotalBS = itemTotalUSD * currentRate;
                    totalUSD += itemTotalUSD;

                    itemsHTML += `
                        <div class="debt-item-row">
                            <div class="item-details">
                                <span>${product.name} (${quantity}x)</span>
                            </div>
                            <span class="debt-item-price">$${itemTotalUSD.toFixed(2)} / Bs. ${itemTotalBS.toFixed(2)}</span>
                        </div>
                    `;
                }
            });
        }
        
        const totalBS = totalUSD * currentRate;
        
        const cardHtml = `
            <div class="debtor-card">
                <div class="debtor-header">
                    <span>${d.name}</span>
                    <div class="debtor-actions">
                        <button onclick="openDebtItemsModal(${d.id})"><span class="material-icons" style="font-size: 16px; margin-right: 5px; vertical-align: bottom;">add_shopping_cart</span> Añadir</button>
                        <button onclick="deleteDebtor(${d.id})"><span class="material-icons" style="font-size: 16px; vertical-align: bottom;">delete</span></button>
                    </div>
                </div>
                <div class="debtor-list-content">
                    ${itemsHTML}
                </div>
                <div class="cart-summary" style="padding: 10px 15px; margin-top: 0; border-top: 1px solid #eee;">
                    <div class="cart-total-row" style="font-size: 0.9rem;">
                        <span>Total USD:</span>
                        <span>$${totalUSD.toFixed(2)}</span>
                    </div>
                    <div class="cart-total-row" style="margin-bottom: 0;">
                        <span class="total-bs-final" style="font-size: 1.1rem;">TOTAL BS:</span>
                        <span class="total-bs-final" style="font-size: 1.1rem;">Bs. ${totalBS.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });
}

// --- MANEJO DE IMÁGENES Y ESCÁNER ---
window.handleImage = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_WIDTH = 400; 
                const scale = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH; 
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                
                document.getElementById('previewImg').src = dataUrl;
                document.getElementById('previewImg').style.display = 'block';
                document.getElementById('prodImgBase64').value = dataUrl;
            }
        }
        reader.readAsDataURL(input.files[0]);
    }
}

window.startScanner = function(mode) {
    scanMode = mode;
    openModal('scannerModal');
    document.getElementById('httpsError').style.display = 'none'; 

    if(isScanning) return;

    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        document.getElementById('httpsError').style.display = 'block';
        return;
    }
    
    document.getElementById('scanTitle').textContent = scanMode === 'search' ? 'Escaneando para Buscar...' : 'Escaneando Código de Barras...';

    html5QrcodeScanner = new Html5Qrcode("reader");
    const config = { 
        fps: 20, 
        qrbox: { width: 250, height: 200 }, 
        aspectRatio: 1.0
    };
    
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        config, 
        onScanSuccess
    )
    .catch(err => {
        console.error("Error al iniciar la cámara para el escáner:", err);
        document.getElementById('httpsError').style.display = 'block';
    });
    isScanning = true;
}

window.stopScanner = function() {
    if (html5QrcodeScanner && isScanning) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            isScanning = false;
        }).catch(err => console.error("Error al detener el escáner:", err));
    }
}

function onScanSuccess(decodedText) {
    if (navigator.vibrate) navigator.vibrate(200); 
    closeModal('scannerModal');
    stopScanner();
    
    if (scanMode === 'search') {
        document.getElementById('searchInput').value = decodedText;
        renderProducts(decodedText);
        showToast(`Búsqueda por código: ${decodedText}`);
    } else {
        const existe = products.some(p => p.code === decodedText);
        if (existe) {
            // Reemplazado alert() por showToast()
            showToast("⚠️ Producto ya existe. No se puede usar el código.");
        } else {
            document.getElementById('prodCode').value = decodedText;
            showToast("Código de barras capturado.");
        }
    }
}