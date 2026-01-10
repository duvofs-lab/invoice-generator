// Invoice Generator App - Main JavaScript
class InvoiceApp {
    constructor() {
        this.invoiceData = null;
        this.drafts = [];
        this.currentDraftId = null;
        this.currencySymbols = {
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥',
            'CAD': '$',
            'INR': '₹',
            'AUD': '$'
        };
        
        this.initializeApp();
    }

    initializeApp() {
        // Set default dates
        this.setDefaultDates();
        
        // Initialize event listeners
        this.setupEventListeners();
        
        // Load saved drafts
        this.loadDrafts();
        
        // Add default items
        this.addDefaultItems();
        
        // Calculate initial totals
        this.calculateTotals();
    }

    setDefaultDates() {
        const today = new Date();
        const dueDate = new Date();
        dueDate.setDate(today.getDate() + 15); // Default 15 days
        
        document.getElementById('invoiceDate').value = this.formatDate(today);
        document.getElementById('dueDate').value = this.formatDate(dueDate);
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    setupEventListeners() {
        // Download PDF button
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadPDF());
        
        // Save Draft button
        document.getElementById('saveDraftBtn').addEventListener('click', () => this.saveDraft());
        
        // Add Item button
        document.getElementById('addItemBtn').addEventListener('click', () => this.addNewItem());
        
        // Logo upload
        document.getElementById('logoUpload').addEventListener('click', () => this.uploadLogo());
        document.getElementById('logoInput').addEventListener('change', (e) => this.handleLogoUpload(e));
        
        // Same as billing checkbox
        document.getElementById('sameAsBilling').addEventListener('change', (e) => this.handleSameAsBilling(e));
        
        // Payment terms
        document.querySelectorAll('.payment-term-option').forEach(option => {
            option.addEventListener('click', (e) => this.handlePaymentTerm(e));
        });
        
        // Currency change
        document.getElementById('currencySelect').addEventListener('change', () => this.updateCurrency());
        
        // Amount control toggles
        this.setupAmountControls();
        
        // Invoice number save
        document.getElementById('invoiceNumber').addEventListener('blur', () => this.saveInvoiceNumber());
        document.getElementById('invoiceNumber').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        });
        
        // Calculate totals on input changes
        this.setupCalculationListeners();
        
        // Auto-save on editable content changes
        this.setupAutoSave();
        
        // Double-click invoice number to generate
        document.getElementById('invoiceNumber').addEventListener('dblclick', () => this.generateInvoiceNumber());
    }

    setupAmountControls() {
        // Tax control
        const taxControl = document.getElementById('taxControl');
        taxControl.querySelectorAll('.toggle-option').forEach(option => {
            option.addEventListener('click', (e) => this.toggleAmountType(e, 'tax'));
        });
        
        // Discount control
        const discountControl = document.getElementById('discountControl');
        discountControl.querySelectorAll('.toggle-option').forEach(option => {
            option.addEventListener('click', (e) => this.toggleAmountType(e, 'discount'));
        });
        
        // Shipping control
        const shippingControl = document.getElementById('shippingControl');
        shippingControl.querySelectorAll('.toggle-option').forEach(option => {
            option.addEventListener('click', (e) => this.toggleAmountType(e, 'shipping'));
        });
        
        // Input listeners
        document.getElementById('taxValue').addEventListener('input', () => this.calculateTax());
        document.getElementById('discountValue').addEventListener('input', () => this.calculateDiscount());
        document.getElementById('shippingValue').addEventListener('input', () => this.calculateShipping());
        document.getElementById('amountPaid').addEventListener('input', () => this.calculateBalanceDue());
    }

    setupCalculationListeners() {
        // Listen to all item inputs
        document.getElementById('itemsTableBody').addEventListener('input', (e) => {
            if (e.target.classList.contains('item-input')) {
                this.updateItemAmount(e.target.closest('tr'));
                this.calculateTotals();
            }
        });
        
        // Listen to amount paid
        document.getElementById('amountPaid').addEventListener('input', () => this.calculateBalanceDue());
    }

    setupAutoSave() {
        // Auto-save on contenteditable blur
        document.querySelectorAll('[contenteditable="true"]').forEach(element => {
            element.addEventListener('blur', () => {
                this.saveDraft();
                this.showToast('Changes auto-saved', 'success');
            });
        });
        
        // Auto-save on textarea/input changes with debounce
        let saveTimeout;
        const saveDebounce = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.saveDraft();
            }, 2000);
        };
        
        ['billFrom', 'billTo', 'shipTo', 'notes', 'terms'].forEach(id => {
            document.getElementById(id).addEventListener('input', saveDebounce);
        });
        
        ['invoiceDate', 'dueDate', 'poNumber'].forEach(id => {
            document.getElementById(id).addEventListener('change', saveDebounce);
        });
    }

    addDefaultItems() {
        const items = [
            { description: 'Web Design Services', quantity: 10, rate: 75 },
            { description: 'Website Hosting (Annual)', quantity: 1, rate: 240 },
            { description: 'Consultation Services', quantity: 5, rate: 100 }
        ];
        
        items.forEach(item => this.addItemRow(item.description, item.quantity, item.rate));
    }

    addItemRow(description = '', quantity = 1, rate = 0) {
        const tbody = document.getElementById('itemsTableBody');
        const row = document.createElement('tr');
        const rowId = Date.now();
        
        row.innerHTML = `
            <td><input type="text" class="item-input" value="${description}" placeholder="Item description"></td>
            <td><input type="number" class="item-input" value="${quantity}" min="1"></td>
            <td><input type="number" class="item-input" value="${rate}" step="0.01"></td>
            <td><strong class="item-amount">$0.00</strong></td>
            <td><button class="delete-item-btn" onclick="app.deleteItem(this)"><i class="fas fa-trash"></i></button></td>
        `;
        
        tbody.appendChild(row);
        this.updateItemAmount(row);
        this.calculateTotals();
        return row;
    }

    addNewItem() {
        this.addItemRow('', 1, 0);
        this.showToast('New item added', 'success');
    }

    deleteItem(button) {
        const row = button.closest('tr');
        row.remove();
        this.calculateTotals();
        this.saveDraft();
        this.showToast('Item removed', 'warning');
    }

    updateItemAmount(row) {
        const quantity = parseFloat(row.querySelector('td:nth-child(2) input').value) || 0;
        const rate = parseFloat(row.querySelector('td:nth-child(3) input').value) || 0;
        const amount = quantity * rate;
        const currency = this.getCurrentCurrency();
        
        row.querySelector('.item-amount').textContent = 
            `${currency.symbol}${amount.toFixed(2)}`;
    }

    calculateSubtotal() {
        const rows = document.querySelectorAll('#itemsTableBody tr');
        let subtotal = 0;
        
        rows.forEach(row => {
            const quantity = parseFloat(row.querySelector('td:nth-child(2) input').value) || 0;
            const rate = parseFloat(row.querySelector('td:nth-child(3) input').value) || 0;
            subtotal += quantity * rate;
        });
        
        return subtotal;
    }

    calculateTax() {
        const subtotal = this.calculateSubtotal();
        const taxType = document.querySelector('#taxControl .toggle-option.active').dataset.type;
        const taxInput = document.getElementById('taxValue');
        const taxAmountInput = document.getElementById('taxAmount');
        const suffix = document.getElementById('taxSuffix');
        const currency = this.getCurrentCurrency();
        
        let tax = 0;
        
        if (taxType === 'percentage') {
            const percentage = parseFloat(taxInput.value) || 0;
            tax = subtotal * (percentage / 100);
            suffix.textContent = '%';
            taxAmountInput.value = tax.toFixed(2);
        } else {
            tax = parseFloat(taxInput.value) || 0;
            suffix.textContent = currency.symbol;
            const percentage = subtotal > 0 ? (tax / subtotal * 100) : 0;
            taxAmountInput.value = percentage.toFixed(2);
        }
        
        this.calculateTotals();
        return tax;
    }

    calculateDiscount() {
        const subtotal = this.calculateSubtotal();
        const discountType = document.querySelector('#discountControl .toggle-option.active').dataset.type;
        const discountInput = document.getElementById('discountValue');
        const discountAmountInput = document.getElementById('discountAmount');
        const suffix = document.getElementById('discountSuffix');
        const currency = this.getCurrentCurrency();
        
        let discount = 0;
        
        if (discountType === 'percentage') {
            const percentage = parseFloat(discountInput.value) || 0;
            discount = subtotal * (percentage / 100);
            suffix.textContent = '%';
            discountAmountInput.value = discount.toFixed(2);
        } else {
            discount = parseFloat(discountInput.value) || 0;
            suffix.textContent = currency.symbol;
            const percentage = subtotal > 0 ? (discount / subtotal * 100) : 0;
            discountAmountInput.value = percentage.toFixed(2);
        }
        
        this.calculateTotals();
        return discount;
    }

    calculateShipping() {
        const subtotal = this.calculateSubtotal();
        const shippingType = document.querySelector('#shippingControl .toggle-option.active').dataset.type;
        const shippingInput = document.getElementById('shippingValue');
        const shippingAmountInput = document.getElementById('shippingAmount');
        const suffix = document.getElementById('shippingSuffix');
        const currency = this.getCurrentCurrency();
        
        let shipping = 0;
        
        if (shippingType === 'percentage') {
            const percentage = parseFloat(shippingInput.value) || 0;
            shipping = subtotal * (percentage / 100);
            suffix.textContent = '%';
            shippingAmountInput.value = shipping.toFixed(2);
        } else {
            shipping = parseFloat(shippingInput.value) || 0;
            suffix.textContent = currency.symbol;
            const percentage = subtotal > 0 ? (shipping / subtotal * 100) : 0;
            shippingAmountInput.value = percentage.toFixed(2);
        }
        
        this.calculateTotals();
        return shipping;
    }

    calculateTotals() {
        const subtotal = this.calculateSubtotal();
        const tax = this.calculateTax();
        const discount = this.calculateDiscount();
        const shipping = this.calculateShipping();
        const currency = this.getCurrentCurrency();
        
        const totalAmount = subtotal + tax - discount + shipping;
        const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;
        const balanceDue = totalAmount - amountPaid;
        
        // Update display
        document.getElementById('subtotal').textContent = `${currency.symbol}${subtotal.toFixed(2)}`;
        document.getElementById('totalAmount').textContent = `${currency.symbol}${totalAmount.toFixed(2)}`;
        document.getElementById('balanceDue').textContent = `${currency.symbol}${balanceDue.toFixed(2)}`;
        
        // Update item amounts with current currency
        document.querySelectorAll('.item-amount').forEach(el => {
            const currentText = el.textContent;
            if (!currentText.startsWith(currency.symbol)) {
                const amount = parseFloat(currentText.replace(/[^\d.-]/g, '')) || 0;
                el.textContent = `${currency.symbol}${amount.toFixed(2)}`;
            }
        });
        
        return {
            subtotal,
            tax,
            discount,
            shipping,
            totalAmount,
            amountPaid,
            balanceDue
        };
    }

    calculateBalanceDue() {
        const totals = this.calculateTotals();
        return totals.balanceDue;
    }

    toggleAmountType(e, controlType) {
        const toggleContainer = e.target.closest('.toggle-switch');
        const options = toggleContainer.querySelectorAll('.toggle-option');
        const valueInput = document.getElementById(`${controlType}Value`);
        const amountInput = document.getElementById(`${controlType}Amount`);
        const suffix = document.getElementById(`${controlType}Suffix`);
        const currency = this.getCurrentCurrency();
        
        // Update active state
        options.forEach(opt => opt.classList.remove('active'));
        e.target.classList.add('active');
        
        const type = e.target.dataset.type;
        
        if (type === 'percentage') {
            suffix.textContent = '%';
            // Convert current amount to percentage
            const subtotal = this.calculateSubtotal();
            const currentAmount = parseFloat(amountInput.value) || 0;
            const percentage = subtotal > 0 ? (currentAmount / subtotal * 100) : 0;
            valueInput.value = percentage.toFixed(2);
        } else {
            suffix.textContent = currency.symbol;
            // Convert current percentage to amount
            const subtotal = this.calculateSubtotal();
            const currentPercentage = parseFloat(valueInput.value) || 0;
            const amount = subtotal * (currentPercentage / 100);
            valueInput.value = amount.toFixed(2);
        }
        
        this.calculateTotals();
    }

    handlePaymentTerm(e) {
        const target = e.target.closest('.payment-term-option');
        const allOptions = document.querySelectorAll('.payment-term-option');
        
        // Update active state
        allOptions.forEach(opt => opt.classList.remove('active'));
        target.classList.add('active');
        
        // If custom days, focus the input
        if (target.dataset.days === 'custom') {
            const input = target.querySelector('.custom-days-input');
            setTimeout(() => input.focus(), 100);
        } else {
            // Update due date based on selected days
            const days = parseInt(target.dataset.days);
            this.updateDueDate(days);
        }
    }

    updateDueDate(days) {
        const invoiceDate = document.getElementById('invoiceDate').value;
        if (!invoiceDate) return;
        
        const date = new Date(invoiceDate);
        date.setDate(date.getDate() + days);
        document.getElementById('dueDate').value = this.formatDate(date);
    }

    handleSameAsBilling(e) {
        const shipToField = document.getElementById('shipTo');
        const billToField = document.getElementById('billTo');
        
        if (e.target.checked) {
            // Store original value
            if (!shipToField.dataset.original) {
                shipToField.dataset.original = shipToField.value;
            }
            shipToField.value = billToField.value;
            shipToField.disabled = true;
            shipToField.style.backgroundColor = '#f0f4ff';
        } else {
            shipToField.disabled = false;
            shipToField.style.backgroundColor = '';
            // Restore original value if it exists
            if (shipToField.dataset.original) {
                shipToField.value = shipToField.dataset.original;
            }
        }
    }

    uploadLogo() {
        document.getElementById('logoInput').click();
    }

    handleLogoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.match('image.*')) {
            this.showToast('Please select an image file', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const logoPreview = document.getElementById('logoPreview');
            logoPreview.innerHTML = `<img src="${event.target.result}" alt="Logo">`;
            logoPreview.style.display = 'block';
            this.showToast('Logo uploaded successfully', 'success');
            this.saveDraft();
        };
        reader.readAsDataURL(file);
    }

    generateInvoiceNumber() {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const randomNum = Math.floor(Math.random() * 999) + 1;
        const newInvoiceNumber = `#INV-${year}-${month}-${String(randomNum).padStart(3, '0')}`;
        
        document.getElementById('invoiceNumber').value = newInvoiceNumber;
        this.saveInvoiceNumber();
        this.showToast('New invoice number generated', 'success');
    }

    saveInvoiceNumber() {
        const invoiceNumber = document.getElementById('invoiceNumber').value;
        if (!invoiceNumber.trim()) {
            document.getElementById('invoiceNumber').value = '#INV-2023-001';
        } else if (!invoiceNumber.startsWith('#')) {
            document.getElementById('invoiceNumber').value = '#' + invoiceNumber.trim();
        }
        
        this.showToast('Invoice number saved', 'success');
        this.saveDraft();
    }

    updateCurrency() {
        const currency = this.getCurrentCurrency();
        
        // Update currency symbols
        document.querySelectorAll('.item-amount, #subtotal, #totalAmount, #balanceDue').forEach(el => {
            const currentText = el.textContent;
            const amount = parseFloat(currentText.replace(/[^\d.-]/g, '')) || 0;
            el.textContent = `${currency.symbol}${amount.toFixed(2)}`;
        });
        
        // Update toggle suffix if in amount mode
        ['tax', 'discount', 'shipping'].forEach(type => {
            const suffix = document.getElementById(`${type}Suffix`);
            const isAmountMode = document.querySelector(`#${type}Control .toggle-option[data-type="amount"]`).classList.contains('active');
            if (isAmountMode) {
                suffix.textContent = currency.symbol;
            }
        });
        
        this.calculateTotals();
        this.showToast(`Currency changed to ${currency.code}`, 'success');
    }

    getCurrentCurrency() {
        const select = document.getElementById('currencySelect');
        const code = select.value;
        const symbol = this.currencySymbols[code] || '$';
        return { code, symbol };
    }

    saveDraft() {
        const draft = {
            id: this.currentDraftId || Date.now().toString(),
            timestamp: new Date().toISOString(),
            data: this.collectInvoiceData()
        };
        
        // Check if draft already exists
        const existingIndex = this.drafts.findIndex(d => d.id === draft.id);
        if (existingIndex !== -1) {
            this.drafts[existingIndex] = draft;
        } else {
            this.drafts.push(draft);
            this.currentDraftId = draft.id;
        }
        
        // Save to localStorage
        localStorage.setItem('invoiceDrafts', JSON.stringify(this.drafts));
        localStorage.setItem('lastSavedDraft', draft.id);
        
        this.showToast('Draft saved successfully', 'success');
        return draft;
    }

    loadDrafts() {
        const savedDrafts = localStorage.getItem('invoiceDrafts');
        if (savedDrafts) {
            this.drafts = JSON.parse(savedDrafts);
            this.showToast(`${this.drafts.length} draft(s) loaded`, 'success');
            
            // Load last saved draft
            const lastDraftId = localStorage.getItem('lastSavedDraft');
            if (lastDraftId) {
                const lastDraft = this.drafts.find(d => d.id === lastDraftId);
                if (lastDraft) {
                    this.loadDraftData(lastDraft.data);
                    this.currentDraftId = lastDraft.id;
                }
            }
        } else {
            this.drafts = [];
        }
    }

    collectInvoiceData() {
        // Collect all form data
        const data = {
            // Basic info
            invoiceNumber: document.getElementById('invoiceNumber').value,
            invoiceDate: document.getElementById('invoiceDate').value,
            dueDate: document.getElementById('dueDate').value,
            poNumber: document.getElementById('poNumber').value,
            
            // Addresses
            billFrom: document.getElementById('billFrom').value,
            billTo: document.getElementById('billTo').value,
            shipTo: document.getElementById('shipTo').value,
            sameAsBilling: document.getElementById('sameAsBilling').checked,
            
            // Payment terms
            paymentTerms: this.getSelectedPaymentTerms(),
            
            // Items
            items: this.collectItemsData(),
            
            // Totals
            currency: document.getElementById('currencySelect').value,
            tax: {
                type: document.querySelector('#taxControl .toggle-option.active').dataset.type,
                value: document.getElementById('taxValue').value,
                amount: document.getElementById('taxAmount').value
            },
            discount: {
                type: document.querySelector('#discountControl .toggle-option.active').dataset.type,
                value: document.getElementById('discountValue').value,
                amount: document.getElementById('discountAmount').value
            },
            shipping: {
                type: document.querySelector('#shippingControl .toggle-option.active').dataset.type,
                value: document.getElementById('shippingValue').value,
                amount: document.getElementById('shippingAmount').value
            },
            amountPaid: document.getElementById('amountPaid').value,
            
            // Notes & Terms
            notes: document.getElementById('notes').value,
            terms: document.getElementById('terms').value,
            
            // Logo
            logo: document.querySelector('#logoPreview img')?.src || null,
            
            // Editable headings (collect all)
            headings: this.collectEditableHeadings()
        };
        
        return data;
    }

    collectItemsData() {
        const items = [];
        const rows = document.querySelectorAll('#itemsTableBody tr');
        
        rows.forEach(row => {
            const description = row.querySelector('td:nth-child(1) input').value;
            const quantity = parseFloat(row.querySelector('td:nth-child(2) input').value) || 0;
            const rate = parseFloat(row.querySelector('td:nth-child(3) input').value) || 0;
            const amount = quantity * rate;
            
            items.push({ description, quantity, rate, amount });
        });
        
        return items;
    }

    collectEditableHeadings() {
        const headings = {};
        document.querySelectorAll('[contenteditable="true"]').forEach(el => {
            const key = el.textContent.substring(0, 20).toLowerCase().replace(/\s+/g, '_');
            headings[key] = el.textContent;
        });
        return headings;
    }

    loadDraftData(data) {
        // Basic info
        document.getElementById('invoiceNumber').value = data.invoiceNumber || '#INV-2023-001';
        document.getElementById('invoiceDate').value = data.invoiceDate || '';
        document.getElementById('dueDate').value = data.dueDate || '';
        document.getElementById('poNumber').value = data.poNumber || '';
        
        // Addresses
        document.getElementById('billFrom').value = data.billFrom || '';
        document.getElementById('billTo').value = data.billTo || '';
        document.getElementById('shipTo').value = data.shipTo || '';
        document.getElementById('sameAsBilling').checked = data.sameAsBilling || false;
        
        if (data.sameAsBilling) {
            document.getElementById('shipTo').disabled = true;
            document.getElementById('shipTo').style.backgroundColor = '#f0f4ff';
        }
        
        // Payment terms
        this.setPaymentTerms(data.paymentTerms || '15');
        
        // Items
        this.loadItemsData(data.items || []);
        
        // Currency
        document.getElementById('currencySelect').value = data.currency || 'USD';
        
        // Tax
        if (data.tax) {
            this.setAmountControl('tax', data.tax.type, data.tax.value, data.tax.amount);
        }
        
        // Discount
        if (data.discount) {
            this.setAmountControl('discount', data.discount.type, data.discount.value, data.discount.amount);
        }
        
        // Shipping
        if (data.shipping) {
            this.setAmountControl('shipping', data.shipping.type, data.shipping.value, data.shipping.amount);
        }
        
        // Amount paid
        document.getElementById('amountPaid').value = data.amountPaid || '0';
        
        // Notes & Terms
        document.getElementById('notes').value = data.notes || '';
        document.getElementById('terms').value = data.terms || '';
        
        // Logo
        if (data.logo) {
            const logoPreview = document.getElementById('logoPreview');
            logoPreview.innerHTML = `<img src="${data.logo}" alt="Logo">`;
            logoPreview.style.display = 'block';
        }
        
        // Recalculate totals
        setTimeout(() => this.calculateTotals(), 100);
    }

    setAmountControl(type, controlType, value, amount) {
        const control = document.getElementById(`${type}Control`);
        const toggleOptions = control.querySelectorAll('.toggle-option');
        const valueInput = document.getElementById(`${type}Value`);
        const amountInput = document.getElementById(`${type}Amount`);
        const suffix = document.getElementById(`${type}Suffix`);
        
        // Set toggle state
        toggleOptions.forEach(opt => {
            opt.classList.remove('active');
            if (opt.dataset.type === controlType) {
                opt.classList.add('active');
            }
        });
        
        // Set values
        valueInput.value = value;
        amountInput.value = amount;
        suffix.textContent = controlType === 'percentage' ? '%' : this.getCurrentCurrency().symbol;
    }

    loadItemsData(items) {
        // Clear existing items
        document.getElementById('itemsTableBody').innerHTML = '';
        
        // Add items from data
        if (items.length > 0) {
            items.forEach(item => {
                this.addItemRow(item.description, item.quantity, item.rate);
            });
        } else {
            // Add default items if no items in data
            this.addDefaultItems();
        }
    }

    setPaymentTerms(days) {
        const options = document.querySelectorAll('.payment-term-option');
        let found = false;
        
        options.forEach(option => {
            if (option.dataset.days === days.toString()) {
                option.classList.add('active');
                found = true;
                
                // Update due date
                this.updateDueDate(parseInt(days));
            } else {
                option.classList.remove('active');
            }
        });
        
        // If custom days
        if (!found && days) {
            const customOption = document.querySelector('.payment-term-option[data-days="custom"]');
            const customInput = customOption.querySelector('.custom-days-input');
            customOption.classList.add('active');
            customInput.value = days;
            this.updateDueDate(parseInt(days));
        }
    }

    getSelectedPaymentTerms() {
        const activeOption = document.querySelector('.payment-term-option.active');
        if (activeOption.dataset.days === 'custom') {
            const input = activeOption.querySelector('.custom-days-input');
            return input.value || '15';
        }
        return activeOption.dataset.days || '15';
    }

    async downloadPDF() {
        const downloadBtn = document.getElementById('downloadBtn');
        const originalText = downloadBtn.innerHTML;
        
        try {
            downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating PDF...';
            downloadBtn.disabled = true;
            
            // Create a copy of the invoice for PDF generation
            const invoiceData = this.collectInvoiceData();
            
            // Use html2canvas and jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            
            // Capture the invoice form
            const element = document.querySelector('.invoice-form');
            
            // Show loading message
            this.showToast('Generating PDF...', 'info');
            
            // Use html2canvas to capture the element
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = canvas.height * imgWidth / canvas.width;
            
            // Add image to PDF
            doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            
            // If content is too long, add new page
            let heightLeft = imgHeight;
            let position = 0;
            
            while (heightLeft >= pageHeight) {
                position = heightLeft - pageHeight;
                doc.addPage();
                doc.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            
            // Save the PDF
            const fileName = `invoice_${invoiceData.invoiceNumber.replace('#', '')}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            
            this.showToast('PDF downloaded successfully!', 'success');
            
        } catch (error) {
            console.error('PDF generation error:', error);
            this.showToast('Failed to generate PDF. Please try again.', 'error');
        } finally {
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast';
        
        // Add type class
        if (type === 'error') {
            toast.classList.add('error');
        } else if (type === 'warning') {
            toast.classList.add('warning');
        } else if (type === 'success') {
            toast.classList.add('success');
        }
        
        // Show toast
        toast.classList.add('show');
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Utility function to clear all data
    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            localStorage.removeItem('invoiceDrafts');
            localStorage.removeItem('lastSavedDraft');
            this.drafts = [];
            this.currentDraftId = null;
            
            // Reset form
            location.reload();
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new InvoiceApp();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+S to save draft
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            app.saveDraft();
        }
        
        // Ctrl+P to download PDF
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            app.downloadPDF();
        }
        
        // Ctrl+N to add new item
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            app.addNewItem();
        }
    });
    
    // Show welcome message
    setTimeout(() => {
        app.showToast('Welcome to SparkBill! Start creating your invoice.', 'info');
    }, 1000);
});

// Global function for delete item (used in inline onclick)
window.deleteItem = function(button) {
    if (window.app) {
        window.app.deleteItem(button);
    }
};
