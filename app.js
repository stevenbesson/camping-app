// Application CampOrganizer
import { db, ref, get, set, update, onValue } from './firebase.js';

class CampingApp {
    constructor() {
        this.camps = [];
        this.currentCampId = null;
        this.map = null;
        this.tempCampData = null;
        this.firebaseRef = ref(db, 'camps');
        this.loadCampsFromFirebase();
        this.initEventListeners();
    }

    // ========== STORAGE - Firebase ==========
    loadCampsFromFirebase() {
        // Écouter les changements en temps réel
        onValue(this.firebaseRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                this.camps = Object.values(data);
                // Normaliser les données: s'assurer que l'inventaire a assignedTo et que expenses existe
                this.camps.forEach(camp => {
                    if (!camp.participants) {
                        camp.participants = [];
                    }
                    if (camp.inventory && Array.isArray(camp.inventory)) {
                        camp.inventory.forEach(item => {
                            if (!item.assignedTo) {
                                item.assignedTo = [];
                            }
                        });
                    }
                    if (!camp.expenses) {
                        camp.expenses = [];
                    }
                });
            } else {
                this.camps = [];
            }
            this.renderCampsList();
            // Si un camp est actuellement sélectionné, le rafraîchir
            if (this.currentCampId) {
                this.selectCamp(this.currentCampId);
            }
        });
    }

    async saveCamps() {
        try {
            const campsObj = {};
            this.camps.forEach((camp, idx) => {
                campsObj[camp.id] = camp;
            });
            await set(this.firebaseRef, campsObj);
        } catch (error) {
            console.error('Erreur Firebase:', error);
        }
    }

    async saveCamp(id) {
        try {
            const camp = this.camps.find(c => c.id === id);
            if (camp) {
                await update(ref(db, `camps/${id}`), camp);
            }
        } catch (error) {
            console.error('Erreur Firebase:', error);
        }
    }

    // ========== CURRENT CAMP ==========
    getCurrentCamp() {
        return this.camps.find(c => c.id === this.currentCampId);
    }

    // ========== EVENT LISTENERS ==========
    initEventListeners() {
        // Modal
        document.getElementById('newCampBtn').addEventListener('click', () => this.openNewCampModal());
        document.getElementById('joinCampBtn').addEventListener('click', () => this.openJoinCampModal());
        document.getElementById('cancelCampBtn').addEventListener('click', () => this.closeNewCampModal());
        document.getElementById('cancelJoinBtn').addEventListener('click', () => this.closeJoinCampModal());
        document.getElementById('confirmJoinBtn').addEventListener('click', () => this.joinCampByCode());
        document.getElementById('joinCampCode').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinCampByCode();
        });
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (e.target.closest('#newCampModal')) this.closeNewCampModal();
                if (e.target.closest('#participantsModal')) this.closeParticipantsModal();
                if (e.target.closest('#joinCampModal')) this.closeJoinCampModal();
            });
        });
        document.getElementById('nextCampBtn').addEventListener('click', () => this.goToParticipantsStep());
        document.getElementById('backParticipantsBtn').addEventListener('click', () => this.backToCampStep());
        document.getElementById('finishCampBtn').addEventListener('click', () => this.createCamp());
        document.getElementById('deleteCampBtn').addEventListener('click', () => this.deleteCamp());

        // Camp selection
        document.getElementById('campSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectCamp(e.target.value);
            }
        });

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Participants
        document.getElementById('addParticipantBtn').addEventListener('click', () => this.addParticipant());
        document.getElementById('newParticipantName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addParticipant();
        });

        // Expenses
        document.getElementById('addExpenseBtn').addEventListener('click', () => this.addExpense());
        document.getElementById('expenseAmount').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addExpense();
        });
        const selectAllBtn = document.getElementById('selectAllParticipantsBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                document.querySelectorAll('.expense-participant-checkbox').forEach(cb => {
                    cb.checked = true;
                });
            });
        }

        // Equipment
        document.getElementById('customEquipmentBtn').addEventListener('click', () => {
            document.getElementById('customEquipmentForm').classList.toggle('hidden');
        });
        document.getElementById('addCustomEquipmentBtn').addEventListener('click', () => this.addCustomEquipment());

        // Food
        document.getElementById('customFoodBtn').addEventListener('click', () => {
            document.getElementById('customFoodForm').classList.toggle('hidden');
        });
        document.getElementById('addCustomFoodBtn').addEventListener('click', () => this.addCustomFood());

        // Cars
        document.getElementById('addCarBtn').addEventListener('click', () => this.addCar());
        document.getElementById('carCapacity').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addCar();
        });

        // Route
        document.getElementById('calculateRouteBtn').addEventListener('click', () => this.calculateRoute());

        // Inventory
        document.getElementById('copyCodeBtn')?.addEventListener('click', () => this.copyCampCode());

        // Close modal on overlay click
        document.getElementById('newCampModal').addEventListener('click', (e) => {
            if (e.target.id === 'newCampModal') {
                this.closeNewCampModal();
            }
        });
    }

    // ========== MODAL ==========
    openNewCampModal() {
        document.getElementById('newCampModal').classList.remove('hidden');
    }

    closeNewCampModal() {
        document.getElementById('newCampModal').classList.add('hidden');
        document.getElementById('campName').value = '';
        document.getElementById('campLocation').value = '';
        document.getElementById('campStartDate').value = '';
        document.getElementById('campEndDate').value = '';
        document.getElementById('campPersonCount').value = '';
        this.tempCampData = null;
    }

    closeParticipantsModal() {
        document.getElementById('participantsModal').classList.add('hidden');
        this.tempCampData = null;
    }

    openJoinCampModal() {
        document.getElementById('joinCampModal').classList.remove('hidden');
        document.getElementById('joinCampCode').value = '';
        document.getElementById('joinCampCode').focus();
    }

    closeJoinCampModal() {
        document.getElementById('joinCampModal').classList.add('hidden');
        document.getElementById('joinCampCode').value = '';
    }

    joinCampByCode() {
        const code = document.getElementById('joinCampCode').value.trim().toUpperCase();

        if (!code) {
            alert('Veuillez entrer un code');
            return;
        }

        const camp = this.camps.find(c => c.code === code);
        if (!camp) {
            alert('Code invalide. Camping non trouvé.');
            return;
        }

        this.closeJoinCampModal();
        this.selectCamp(camp.id);
        this.switchTab('participants');
    }

    goToParticipantsStep() {
        const name = document.getElementById('campName').value.trim();
        const location = document.getElementById('campLocation').value.trim();
        const startDate = document.getElementById('campStartDate').value;
        const endDate = document.getElementById('campEndDate').value;
        const personCount = parseInt(document.getElementById('campPersonCount').value);

        if (!name || !location || !startDate || !endDate || personCount <= 0) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        this.tempCampData = {
            name,
            location,
            startDate,
            endDate,
            personCount
        };

        // Afficher le modal des prénoms
        document.getElementById('newCampModal').classList.add('hidden');
        document.getElementById('participantsModal').classList.remove('hidden');

        // Générer les inputs
        const container = document.getElementById('participantsInputs');
        container.innerHTML = '';

        document.getElementById('participantsInstruction').textContent = `Entrez les ${personCount} prénom${personCount > 1 ? 's' : ''} des participant${personCount > 1 ? 's' : ''}`;

        for (let i = 0; i < personCount; i++) {
            const div = document.createElement('div');
            div.className = 'form-group';
            div.innerHTML = `
                <label>Prénom ${i + 1}</label>
                <input type="text" class="participant-input input-field" placeholder="Ex: Jean" />
            `;
            container.appendChild(div);
        }

        // Focus sur le premier input
        setTimeout(() => {
            container.querySelector('.participant-input').focus();
        }, 100);
    }

    backToCampStep() {
        document.getElementById('participantsModal').classList.add('hidden');
        document.getElementById('newCampModal').classList.remove('hidden');
    }

    // ========== CAMPS MANAGEMENT ==========
    async createCamp() {
        if (!this.tempCampData) {
            alert('Erreur: données manquantes');
            return;
        }

        // Récupérer les prénoms
        const inputs = document.querySelectorAll('.participant-input');
        const participants = [];

        inputs.forEach((input, index) => {
            const name = input.value.trim();
            if (!name) {
                alert(`Veuillez entrer le prénom ${index + 1}`);
                input.focus();
                throw new Error('Prénom manquant');
            }
            participants.push({
                id: Date.now().toString() + '_' + index,
                name,
                role: 'participant'
            });
        });

        const camp = {
            id: Date.now().toString(),
            code: this.generateCampCode(),
            name: this.tempCampData.name,
            location: this.tempCampData.location,
            startDate: this.tempCampData.startDate,
            endDate: this.tempCampData.endDate,
            participants,
            expenses: [],
            equipment: [],
            food: [],
            cars: [],
            inventory: [],
            meetingLocation: '',
            departureTime: '',
            campDestination: ''
        };

        this.camps.push(camp);
        await this.saveCamps();
        this.closeParticipantsModal();
        this.renderCampsList();
        this.selectCamp(camp.id);
    }

    async deleteCamp() {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce camping? Cette action est irréversible.')) {
            this.camps = this.camps.filter(c => c.id !== this.currentCampId);
            await this.saveCamps();
            this.currentCampId = null;
            this.renderCampsList();
            document.getElementById('mainContent').classList.add('hidden');
            document.getElementById('emptyState').classList.remove('hidden');
        }
    }

    renderCampsList() {
        const select = document.getElementById('campSelect');
        select.innerHTML = '<option value="">Sélectionner un camping...</option>';

        if (this.camps.length === 0) {
            select.style.display = 'none';
            document.getElementById('emptyState').classList.remove('hidden');
            document.getElementById('mainContent').classList.add('hidden');
        } else {
            select.style.display = 'block';
            this.camps.forEach(camp => {
                const option = document.createElement('option');
                option.value = camp.id;
                option.textContent = `${camp.name} - ${camp.location}`;
                select.appendChild(option);
            });
        }
    }

    selectCamp(campId) {
        this.currentCampId = campId;
        const camp = this.getCurrentCamp();

        document.getElementById('campTitle').textContent = `${camp.name}`;
        const startDate = new Date(camp.startDate).toLocaleDateString('fr-FR');
        const endDate = new Date(camp.endDate).toLocaleDateString('fr-FR');
        document.getElementById('campDates').textContent = `${startDate} - ${endDate} • ${camp.location}`;

        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');

        // Initialiser l'inventaire s'il n'existe pas
        if (!camp.inventory || camp.inventory.length === 0) {
            camp.inventory = this.getFullInventoryList().map((item, idx) => ({
                id: 'inv_' + idx,
                name: item,
                assignedTo: [],
                status: 'unassigned'
            }));
            this.saveCamp(campId);
        }

        document.getElementById('campCode').value = camp.code;
        this.renderInventory();
        this.updateEquipmentChecklists();
        this.updateFoodChecklists();
        this.renderParticipants();
        this.updateExpensePaidByOptions();
        this.renderExpenseParticipants();
        this.renderExpenses();
        this.updateCarDriverOptions();
        this.renderCars();
    }

    generateCampCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    getFullInventoryList() {
        return [
            // Hébergement
            'Tente grande (4+ personnes)',
            'Tente petite (2-3 personnes)',
            'Tente une place',
            'Sacs de couchage',
            'Matelas gonflables',
            'Tapis de sol isolants',
            'Oreillers de camping',

            // Cuisine
            'Réchaud camping',
            'Cartouches gaz (butane)',
            'Casseroles (set)',
            'Poêle à frire',
            'Ustensiles de cuisine',
            'Couteaux de cuisine',
            'Planche à découper',
            'Assiettes',
            'Bols',
            'Verres/Tasses',
            'Couverts',
            'Plateau de service',
            'Seau/Bassin',
            'Savon vaisselle & éponge',
            'Séchoir à vaisselle',

            // Éclairage & Chaleur
            'Lampes frontales',
            'Lampes de poche',
            'Lanternes camping',
            'Bougies',
            'Allumettes/Briquet',
            'Chauffage d\'appoint',

            // Vêtements & Confort
            'Sacs à dos (30L+)',
            'Vêtements chauds',
            'Vestes imperméables',
            'Chaussures de randonnée',
            'Chaussettes (paires)',
            'Chapeau/Casquette',
            'Gants',
            'Maillot de bain',

            // Hygiène & Santé
            'Trousse de premiers soins',
            'Papier toilette',
            'Serviettes hygiéniques',
            'Savon/Gel douche',
            'Crème solaire',
            'Spray anti-moustiques',
            'Crème après-soleil',
            'Brosse à dents',
            'Dentifrice',
            'Shampooing',
            'Déodorant',
            'Serviettes/Torchons',

            // Sécurité & Navigation
            'Carte & boussole',
            'GPS/Phone avec batterie',
            'Lampe d\'urgence',
            'Sifflet d\'urgence',
            'Cordes/Ficelles',
            'Piquets de tente',
            'Marteau de camping',
            'Couteau suisse',
            'Outil multifonction',

            // Loisirs & Divers
            'Jeux de cartes/Jeux de société',
            'Livres',
            'Musique (enceinte)',
            'Ballon/Frisbee',
            'Maillots de bain',
            'Masque de plongée',
            'Sacs à linge',
            'Corde à linge',
            'Pince à linge',

            // Nourriture & Boissons
            'Café/Thé',
            'Sucre/Miel',
            'Sel & épices',
            'Huile d\'olive',
            'Vinaigre',
            'Biscuits/Snacks',
            'Chocolat',
            'Énergie bars',
            'Fruits secs',
            'Noix/Graines',

            // Nettoyage
            'Balai/Pelle',
            'Poubelles',
            'Sacs poubelle',
            'Papier d\'aluminium',
            'Film alimentaire',
            'Boîtes hermétiques',
            'Refroidisseur/Glacière',

            // Supplémentaires
            'Batterie externe',
            'Chargeur solaire',
            'Cable audio',
            'Adaptateur électrique',
            'Lampe UV (insectes)',
            'Répulsif animaux',
            'Parasol/Tente parasol',
            'Hamac',
            'Corde de hamac',
            'Moustiquaire',
            'Bâche imperméable'
        ];
    }

    renderInventory() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        this.renderInventoryList('all');
    }

    renderInventoryList(filter = 'all') {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const container = document.getElementById('inventoryList');
        container.innerHTML = '';

        let filteredItems = camp.inventory;
        if (filter === 'unassigned') {
            filteredItems = camp.inventory.filter(item => item.assignedTo.length === 0);
        } else if (filter === 'assigned') {
            filteredItems = camp.inventory.filter(item => item.assignedTo.length > 0);
        }

        filteredItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'inventory-item';

            // Grouper les assignements par personne
            const assignmentGrouped = {};
            item.assignedTo.forEach(participantId => {
                if (!assignmentGrouped[participantId]) {
                    assignmentGrouped[participantId] = 0;
                }
                assignmentGrouped[participantId]++;
            });

            const assignedHTML = Object.keys(assignmentGrouped).length > 0
                ? `<div class="inventory-item-assigned">
                    ✓ Apporté par: <strong>${Object.entries(assignmentGrouped).map(([id, count]) => {
                        const participant = camp.participants.find(p => p.id === id);
                        return participant ? `${participant.name}${count > 1 ? ` ×${count}` : ''}` : '';
                    }).filter(Boolean).join(', ')}</strong>
                   </div>`
                : '';

            const assignedListHTML = Object.keys(assignmentGrouped).length > 0
                ? `<div class="inventory-assigned-list">
                    ${Object.entries(assignmentGrouped).map(([participantId, count]) => {
                        const participant = camp.participants.find(p => p.id === participantId);
                        return `<div class="assigned-tag">${participant.name}${count > 1 ? ` ×${count}` : ''} <button onclick="app.unassignInventoryItemFromPerson('${item.id}', '${participantId}')" class="unassign-btn">×</button></div>`;
                    }).join('')}
                   </div>`
                : '';

            div.innerHTML = `
                <div class="inventory-item-name">${item.name}</div>
                ${assignedHTML}
                ${assignedListHTML}
                <div class="inventory-item-actions">
                    <select id="participant-select-${item.id}" class="inventory-assign-select">
                        <option value="">Sélectionner une personne...</option>
                        ${camp.participants.map(p => `
                            <option value="${p.id}">${p.name}</option>
                        `).join('')}
                    </select>
                    <input type="number" id="quantity-input-${item.id}" class="inventory-quantity-input" min="1" value="1" placeholder="Qté">
                    <button class="btn btn-primary btn-small" onclick="app.assignInventoryItemWithQuantity('${item.id}')">Ajouter</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    filterInventory(filter) {
        document.querySelectorAll('.inventory-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        this.renderInventoryList(filter);
    }

    assignInventoryItem(itemId, participantId) {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const item = camp.inventory.find(i => i.id === itemId);
        if (!item || !participantId) return;

        // Ajouter l'assignation (permet les doublons - même personne peut assigner plusieurs fois)
        item.assignedTo.push(participantId);
        item.status = 'assigned';

        this.saveCamp(camp.id);
        this.renderInventoryList();
        this.updateEquipmentChecklists();
    }

    assignInventoryItemWithQuantity(itemId) {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const participantSelect = document.getElementById(`participant-select-${itemId}`);
        const quantityInput = document.getElementById(`quantity-input-${itemId}`);

        const participantId = participantSelect.value;
        const quantity = Math.max(1, parseInt(quantityInput.value) || 1);

        if (!participantId) {
            alert('Veuillez sélectionner une personne');
            return;
        }

        const item = camp.inventory.find(i => i.id === itemId);
        if (!item) return;

        // Ajouter plusieurs assignations selon la quantité
        for (let i = 0; i < quantity; i++) {
            item.assignedTo.push(participantId);
        }
        item.status = 'assigned';

        // Réinitialiser le formulaire
        participantSelect.value = '';
        quantityInput.value = '1';

        this.saveCamp(camp.id);
        this.renderInventoryList();
        this.updateEquipmentChecklists();
    }

    unassignInventoryItemFromPerson(itemId, participantId) {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const item = camp.inventory.find(i => i.id === itemId);
        if (!item) return;

        const index = item.assignedTo.indexOf(participantId);
        if (index > -1) {
            item.assignedTo.splice(index, 1);
        }
        item.status = item.assignedTo.length > 0 ? 'assigned' : 'unassigned';

        this.saveCamp(camp.id);
        this.renderInventoryList();
        this.updateEquipmentChecklists();
    }

    copyCampCode() {
        const codeInput = document.getElementById('campCode');
        codeInput.select();
        document.execCommand('copy');

        const btn = document.getElementById('copyCodeBtn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Copié!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }

    // ========== PARTICIPANTS ==========
    addParticipant() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const name = document.getElementById('newParticipantName').value.trim();
        const role = document.getElementById('newParticipantRole').value;

        if (!name) {
            alert('Veuillez entrer un nom');
            return;
        }

        camp.participants.push({
            id: Date.now().toString(),
            name,
            role
        });

        this.saveCamp(camp.id);
        document.getElementById('newParticipantName').value = '';
        this.renderParticipants();
        this.updateEquipmentChecklists();
        this.updateFoodChecklists();
        this.updateExpensePaidByOptions();
        this.updateCarDriverOptions();
    }

    renderParticipants() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const container = document.getElementById('participantsList');
        container.innerHTML = '';

        if (camp.participants.length === 0) {
            container.innerHTML = '<p style="color: #95a5a6; text-align: center; padding: 2rem; grid-column: 1 / -1;">Aucun participant</p>';
            return;
        }

        camp.participants.forEach(participant => {
            const div = document.createElement('div');
            div.className = 'participant-card';
            div.innerHTML = `
                <div>
                    <h4>${participant.name}</h4>
                    <span class="participant-role">${this.getRoleLabel(participant.role)}</span>
                </div>
                <div class="participant-card-actions">
                    <button class="btn btn-secondary" onclick="app.toggleParticipantRole('${participant.id}')" style="flex: 1;">
                        ${participant.role === 'participant' ? '👨‍🚗 Chauffeur' : '👥 Participant'}
                    </button>
                    <button class="btn btn-danger-small" onclick="app.removeParticipant('${participant.id}')" style="flex: 1;">🗑️ Supprimer</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    toggleParticipantRole(participantId) {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const participant = camp.participants.find(p => p.id === participantId);
        if (!participant) return;

        participant.role = participant.role === 'participant' ? 'driver' : 'participant';

        this.saveCamp(camp.id);
        this.renderParticipants();
        this.updateExpensePaidByOptions();
        this.updateCarDriverOptions();
    }

    removeParticipant(participantId) {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        if (confirm('Êtes-vous sûr de supprimer ce participant?')) {
            camp.participants = camp.participants.filter(p => p.id !== participantId);
            this.saveCamp(camp.id);
            this.renderParticipants();
            this.updateEquipmentChecklists();
            this.updateFoodChecklists();
            this.updateExpensePaidByOptions();
            this.renderExpenses();
            this.updateCarDriverOptions();
        }
    }

    getRoleLabel(role) {
        const roles = {
            'participant': 'Participant',
            'driver': 'Chauffeur'
        };
        return roles[role] || role;
    }

    // ========== EXPENSES ==========
    updateExpensePaidByOptions() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const select = document.getElementById('expensePaidBy');
        const currentValue = select.value;
        select.innerHTML = '<option value="">Payé par...</option>';

        camp.participants.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            select.appendChild(option);
        });

        select.value = currentValue;
    }

    renderExpenseParticipants() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const container = document.getElementById('expenseParticipantsCheckboxes');
        if (!container) return;

        container.innerHTML = '';
        camp.participants.forEach(p => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '0.5rem';
            label.style.cursor = 'pointer';
            label.innerHTML = `
                <input type="checkbox" class="expense-participant-checkbox" value="${p.id}" checked>
                <span>${p.name}</span>
            `;
            container.appendChild(label);
        });
    }

    addExpense() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const description = document.getElementById('expenseDescription').value.trim();
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const paidById = document.getElementById('expensePaidBy').value;

        const checkboxes = document.querySelectorAll('.expense-participant-checkbox:checked');
        const includedParticipantIds = Array.from(checkboxes).map(cb => cb.value);

        if (!description || !amount || !paidById) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        if (includedParticipantIds.length === 0) {
            alert('Veuillez sélectionner au moins une personne pour cette dépense');
            return;
        }

        camp.expenses.push({
            id: Date.now().toString(),
            description,
            amount,
            paidById,
            includedParticipantIds,
            date: new Date().toISOString()
        });

        this.saveCamp(camp.id);
        document.getElementById('expenseDescription').value = '';
        document.getElementById('expenseAmount').value = '';
        document.getElementById('expensePaidBy').value = '';
        this.renderExpenseParticipants();
        this.renderExpenses();
    }

    renderExpenses() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const list = document.getElementById('expensesList');
        list.innerHTML = '';

        camp.expenses.forEach(expense => {
            const payer = camp.participants.find(p => p.id === expense.paidById);
            const includedParticipants = camp.participants.filter(p =>
                (expense.includedParticipantIds && expense.includedParticipantIds.includes(p.id)) ||
                (!expense.includedParticipantIds)
            );

            const div = document.createElement('div');
            div.className = 'expense-item';
            const participantNames = includedParticipants.map(p => p.name).join(', ');
            div.innerHTML = `
                <div class="expense-details">
                    <h5>${expense.description}</h5>
                    <p class="expense-by">Payé par <strong>${payer.name}</strong></p>
                    <p style="font-size: 0.85rem; color: #7f8c8d; margin: 0.25rem 0 0 0;">Pour: ${participantNames}</p>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <span class="expense-amount">${expense.amount.toFixed(2)}€</span>
                    <button style="background: #e74c3c; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;" onclick="app.removeExpense('${expense.id}')">X</button>
                </div>
            `;
            list.appendChild(div);
        });

        this.calculateSettlement();
    }

    removeExpense(expenseId) {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        camp.expenses = camp.expenses.filter(e => e.id !== expenseId);
        this.saveCamp(camp.id);
        this.renderExpenses();
    }

    calculateSettlement() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const totalByPerson = {};
        const totalSpent = {};

        camp.participants.forEach(p => {
            totalByPerson[p.id] = 0;
            totalSpent[p.id] = 0;
        });

        camp.expenses.forEach(expense => {
            totalSpent[expense.paidById] += expense.amount;
            const includedParticipants = camp.participants.filter(p =>
                (expense.includedParticipantIds && expense.includedParticipantIds.includes(p.id)) ||
                (!expense.includedParticipantIds)
            );
            const splitAmount = expense.amount / includedParticipants.length;
            includedParticipants.forEach(p => {
                totalByPerson[p.id] += splitAmount;
            });
        });

        const debts = [];
        camp.participants.forEach(p => {
            const owes = totalByPerson[p.id];
            const paid = totalSpent[p.id];
            const balance = paid - owes;

            if (balance < -0.01) {
                debts.push({
                    personId: p.id,
                    personName: p.name,
                    amount: Math.abs(balance)
                });
            }
        });

        const settlements = [];
        debts.sort((a, b) => b.amount - a.amount);

        camp.participants.forEach(p => {
            const balance = totalSpent[p.id] - totalByPerson[p.id];
            if (balance > 0.01) {
                let remaining = balance;
                for (let debt of debts) {
                    if (remaining < 0.01) break;
                    if (debt.personId === p.id) continue;

                    const settlement = Math.min(remaining, debt.amount);
                    settlements.push({
                        from: debt.personName,
                        to: p.name,
                        amount: settlement
                    });
                    remaining -= settlement;
                    debt.amount -= settlement;
                }
            }
        });

        const settlementDiv = document.getElementById('settlementList');
        settlementDiv.innerHTML = '';

        if (settlements.length === 0) {
            settlementDiv.innerHTML = '<p style="color: #2ecc71; font-weight: 600;">✓ Tout est équilibré!</p>';
        } else {
            settlements.forEach(s => {
                const div = document.createElement('div');
                div.className = 'settlement-item';
                div.innerHTML = `
                    <div class="settlement-text">
                        <strong>${s.from}</strong> doit rembourser à <strong>${s.to}</strong>
                    </div>
                    <div class="settlement-amount">${s.amount.toFixed(2)}€</div>
                `;
                settlementDiv.appendChild(div);
            });
        }
    }

    // ========== EQUIPMENT ==========
    getEquipmentByPersonCount(count) {
        const baseEquipment = [
            { name: 'Tente', qty: Math.ceil(count / 2) },
            { name: 'Sacs de couchage', qty: count },
            { name: 'Matelas ou tapis de sol', qty: count },
            { name: 'Oreillers', qty: count },
            { name: 'Lampes de poche / Frontales', qty: Math.ceil(count / 2) },
            { name: 'Réchaud camping', qty: 1 },
            { name: 'Cartouches gaz', qty: count > 4 ? 3 : 2 },
            { name: 'Casseroles / Poêles', qty: 2 },
            { name: 'Assiettes / Bols', qty: count },
            { name: 'Ustensiles (fourchette, cuillère, couteau)', qty: count },
            { name: 'Couteaux de cuisine', qty: 2 },
            { name: 'Planche à découper', qty: 1 },
            { name: 'Verres / Tasses', qty: count },
            { name: 'Seau / Bassin', qty: 2 },
            { name: 'Bougies / Lanternes', qty: 3 },
            { name: 'Cordes / Ficelles', qty: 2 },
            { name: 'Trousse de secours', qty: 1 },
            { name: 'Papier toilette', qty: 4 },
            { name: 'Serviettes / Torchons', qty: 3 },
            { name: 'Sacs à dos', qty: count },
            { name: 'Vêtements de rechange', qty: count },
            { name: 'Chaussures de randonnée', qty: count },
            { name: 'Vestes imperméables', qty: count },
            { name: 'Crème solaire', qty: 1 },
            { name: 'Spray anti-moustiques', qty: 1 },
            { name: 'Cartes / GPS', qty: 1 },
            { name: 'Éclairage camping complet', qty: 1 }
        ];
        return baseEquipment;
    }

    updateEquipmentChecklists() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const count = camp.participants.length;
        document.getElementById('equipmentPersonCount').textContent = count;

        // Récupérer les items assignés de l'inventaire
        const assignedItems = camp.inventory.filter(item => item.assignedTo.length > 0);

        // Vider l'équipement actuel et le remplacer par les items assignés
        // La quantité = nombre de personnes qui l'ont assigné
        camp.equipment = assignedItems.map((item, idx) => ({
            id: item.id,
            name: item.name,
            qty: item.assignedTo.length,
            assignedTo: item.assignedTo,
            checked: false
        }));

        this.saveCamp(camp.id);
        this.renderEquipmentChecklist();
    }

    renderEquipmentChecklist() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const list = document.getElementById('equipmentList');
        list.innerHTML = '';

        camp.equipment.forEach(item => {
            const div = document.createElement('div');
            div.className = 'checklist-item';
            const checked = item.checked ? 'checked' : '';

            // Group participant assignments by name
            let participantNames = '';
            if (item.assignedTo && item.assignedTo.length > 0) {
                const assignmentGrouped = {};
                item.assignedTo.forEach(participantId => {
                    const participant = camp.participants.find(p => p.id === participantId);
                    if (participant) {
                        if (!assignmentGrouped[participant.name]) {
                            assignmentGrouped[participant.name] = 0;
                        }
                        assignmentGrouped[participant.name]++;
                    }
                });
                const groupedNames = Object.entries(assignmentGrouped)
                    .map(([name, count]) => `${name}${count > 1 ? ` ×${count}` : ''}`)
                    .join(', ');
                participantNames = groupedNames ? ` (ramené par ${groupedNames})` : '';
            }

            div.innerHTML = `
                <input type="checkbox" id="eq_${item.id}" ${checked} onchange="app.toggleEquipment('${item.id}')">
                <label for="eq_${item.id}">
                    <span>${item.name}${participantNames}</span>
                    <span class="item-qty">x${item.qty}</span>
                </label>
            `;
            list.appendChild(div);
        });
    }

    toggleEquipment(id) {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const item = camp.equipment.find(e => e.id === id);
        if (item) {
            item.checked = !item.checked;
            this.saveCamp(camp.id);
        }
    }

    addCustomEquipment() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const name = document.getElementById('customEquipmentName').value.trim();
        const qty = parseInt(document.getElementById('customEquipmentQty').value) || 1;

        if (!name) {
            alert('Veuillez entrer un nom');
            return;
        }

        camp.equipment.push({
            id: 'custom_' + Date.now(),
            name,
            qty,
            checked: false
        });

        this.saveCamp(camp.id);
        document.getElementById('customEquipmentName').value = '';
        document.getElementById('customEquipmentQty').value = '1';
        document.getElementById('customEquipmentForm').classList.add('hidden');
        this.renderEquipmentChecklist();
    }

    // ========== FOOD ==========
    getFoodByPersonCount(count) {
        const baseFood = [
            { name: 'Pâtes', qty: `${count * 500}g` },
            { name: 'Riz', qty: `${count * 200}g` },
            { name: 'Pommes de terre', qty: `${count * 400}g` },
            { name: 'Oignons', qty: '3-4' },
            { name: 'Ail', qty: '1 tête' },
            { name: 'Tomates (fraîches ou en conserve)', qty: `${count > 4 ? 4 : 3} boîtes` },
            { name: 'Concentré de tomate', qty: '1 tube' },
            { name: 'Viande hachée (pour chili)', qty: `${count * 200}g` },
            { name: 'Haricots rouges en conserve', qty: '3 boîtes' },
            { name: 'Épices: chili, cumin, paprika', qty: '1 set' },
            { name: 'Salade verte', qty: Math.ceil(count / 3) + ' têtes' },
            { name: 'Tomates', qty: count + '4' },
            { name: 'Concombre', qty: '2' },
            { name: 'Carottes', qty: '1kg' },
            { name: 'Persil / Herbes', qty: '1 botte' },
            { name: 'Fromage', qty: `${count * 100}g` },
            { name: 'Pain', qty: Math.ceil(count / 2) + ' pains' },
            { name: 'Beurre', qty: '250g' },
            { name: 'Charcuterie', qty: `${count * 100}g` },
            { name: 'Œufs', qty: count * 3 + ' œufs' },
            { name: 'Lait', qty: '1-2 litres' },
            { name: 'Café', qty: '250g' },
            { name: 'Thé', qty: '1 boîte' },
            { name: 'Sucre', qty: '500g' },
            { name: 'Sel', qty: '1 boîte' },
            { name: 'Huile d\'olive', qty: '500ml' },
            { name: 'Vinaigre', qty: '250ml' },
            { name: 'Fruits (pommes, oranges)', qty: '3-4 kg' },
            { name: 'Snacks (barres, chips)', qty: 'selon préférence' },
            { name: 'Muesli / Céréales petit-déj', qty: '2 boîtes' }
        ];
        return baseFood;
    }

    updateFoodChecklists() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        if (!camp.food) {
            camp.food = [];
        }

        const count = camp.participants.length;
        document.getElementById('foodPersonCount').textContent = count;

        const food = this.getFoodByPersonCount(count);

        food.forEach(item => {
            let existingId = camp.food.find(e => e.name === item.name)?.id;
            if (!existingId) {
                existingId = 'food_' + Date.now() + Math.random();
                camp.food.push({
                    id: existingId,
                    name: item.name,
                    qty: item.qty,
                    checked: false
                });
            }
        });

        this.renderFoodChecklist();
    }

    renderFoodChecklist() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const list = document.getElementById('foodList');
        list.innerHTML = '';

        camp.food.forEach(item => {
            const div = document.createElement('div');
            div.className = 'checklist-item';
            const checked = item.checked ? 'checked' : '';
            div.innerHTML = `
                <input type="checkbox" id="food_${item.id}" ${checked} onchange="app.toggleFood('${item.id}')">
                <label for="food_${item.id}">
                    <span>${item.name}</span>
                    <span class="item-qty">${item.qty}</span>
                </label>
            `;
            list.appendChild(div);
        });
    }

    toggleFood(id) {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const item = camp.food.find(e => e.id === id);
        if (item) {
            item.checked = !item.checked;
            this.saveCamp(camp.id);
        }
    }

    addCustomFood() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const name = document.getElementById('customFoodName').value.trim();
        const qty = document.getElementById('customFoodQty').value.trim();

        if (!name || !qty) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        camp.food.push({
            id: 'custom_food_' + Date.now(),
            name,
            qty,
            checked: false
        });

        this.saveCamp(camp.id);
        document.getElementById('customFoodName').value = '';
        document.getElementById('customFoodQty').value = '';
        document.getElementById('customFoodForm').classList.add('hidden');
        this.renderFoodChecklist();
    }

    // ========== CARS ==========
    updateCarDriverOptions() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const select = document.getElementById('carDriver');
        const currentValue = select.value;
        select.innerHTML = '<option value="">Chauffeur...</option>';

        camp.participants.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            select.appendChild(option);
        });

        select.value = currentValue;
    }

    addCar() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const driverId = document.getElementById('carDriver').value;
        const model = document.getElementById('carModel').value.trim();
        const capacity = parseInt(document.getElementById('carCapacity').value) || 0;

        if (!driverId || !model || capacity <= 0) {
            alert('Veuillez remplir tous les champs correctement');
            return;
        }

        camp.cars.push({
            id: 'car_' + Date.now(),
            driverId,
            model,
            capacity,
            items: []
        });

        this.saveCamp(camp.id);
        document.getElementById('carDriver').value = '';
        document.getElementById('carModel').value = '';
        document.getElementById('carCapacity').value = '';
        this.renderCars();
    }

    renderCars() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const list = document.getElementById('carsList');
        list.innerHTML = '';

        if (camp.cars.length === 0) {
            list.innerHTML = '<p style="color: #95a5a6; text-align: center; padding: 2rem;">Aucune voiture ajoutée</p>';
            return;
        }

        camp.cars.forEach(car => {
            const driver = camp.participants.find(p => p.id === car.driverId);
            const totalWeight = car.items.reduce((sum, item) => sum + item.weight, 0);
            const percentage = (totalWeight / car.capacity) * 100;
            const isFull = percentage >= 100;

            const div = document.createElement('div');
            div.className = 'car-card';
            div.innerHTML = `
                <div class="car-header">
                    <div class="car-title">
                        <h4>🚗 ${driver.name}</h4>
                        <p class="car-model">${car.model}</p>
                    </div>
                    <button class="car-delete" onclick="app.removeCar('${car.id}')">Supprimer</button>
                </div>
                <div class="capacity-bar">
                    <div class="capacity-label">
                        <span>Capacité: ${totalWeight.toFixed(1)}L / ${car.capacity}L</span>
                        <span>${Math.min(Math.round(percentage), 100)}%</span>
                    </div>
                    <div class="capacity-bar-bg">
                        <div class="capacity-bar-fill ${isFull ? 'full' : ''}" style="width: ${Math.min(percentage, 100)}%">
                            ${Math.round(percentage)}%
                        </div>
                    </div>
                </div>
                <div style="margin-top: 1rem;">
                    <button onclick="app.toggleCarItems('${car.id}')" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">Ajouter/Modifier articles</button>
                    <div id="carItems_${car.id}" class="car-items-form hidden" style="margin-top: 1rem; padding: 1rem; background: #f5f7fa; border-radius: 4px;">
                        <input type="text" id="itemName_${car.id}" placeholder="Article" style="margin-bottom: 0.5rem; width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                        <input type="number" id="itemWeight_${car.id}" placeholder="Poids (kg)" step="0.5" style="margin-bottom: 0.5rem; width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                        <button onclick="app.addCarItem('${car.id}')" class="btn btn-primary" style="width: 100%;">Ajouter article</button>
                        <div id="carItemsList_${car.id}" style="margin-top: 1rem;"></div>
                    </div>
                </div>
            `;
            list.appendChild(div);
            this.renderCarItems(car.id);
        });
    }

    toggleCarItems(carId) {
        document.getElementById(`carItems_${carId}`).classList.toggle('hidden');
    }

    addCarItem(carId) {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const name = document.getElementById(`itemName_${carId}`).value.trim();
        const weight = parseFloat(document.getElementById(`itemWeight_${carId}`).value);

        if (!name || !weight) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        const car = camp.cars.find(c => c.id === carId);
        if (!car) return;

        car.items.push({
            id: 'item_' + Date.now(),
            name,
            weight
        });

        this.saveCamp(camp.id);
        document.getElementById(`itemName_${carId}`).value = '';
        document.getElementById(`itemWeight_${carId}`).value = '';
        this.renderCarItems(carId);
        this.renderCars();
    }

    renderCarItems(carId) {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const car = camp.cars.find(c => c.id === carId);
        if (!car) return;

        const itemsList = document.getElementById(`carItemsList_${carId}`);
        if (!itemsList) return;

        itemsList.innerHTML = '';
        car.items.forEach(item => {
            const div = document.createElement('div');
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 4px; margin-bottom: 0.5rem;';
            div.innerHTML = `
                <span>${item.name} - ${item.weight}kg</span>
                <button onclick="app.removeCarItem('${carId}', '${item.id}')" style="background: #e74c3c; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer;">X</button>
            `;
            itemsList.appendChild(div);
        });
    }

    removeCarItem(carId, itemId) {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const car = camp.cars.find(c => c.id === carId);
        if (car) {
            car.items = car.items.filter(i => i.id !== itemId);
            this.saveCamp(camp.id);
            this.renderCarItems(carId);
            this.renderCars();
        }
    }

    removeCar(carId) {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        camp.cars = camp.cars.filter(c => c.id !== carId);
        this.saveCamp(camp.id);
        this.renderCars();
    }

    // ========== ROUTE ==========
    calculateRoute() {
        const camp = this.getCurrentCamp();
        if (!camp) return;

        const meeting = document.getElementById('meetingLocation').value.trim();
        const departure = document.getElementById('departureTime').value;
        const destination = document.getElementById('campDestination').value.trim();

        if (!meeting || !departure || !destination) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        camp.meetingLocation = meeting;
        camp.departureTime = departure;
        camp.campDestination = destination;

        this.saveCamp(camp.id);

        // Afficher les infos
        document.getElementById('routeInfo').classList.remove('hidden');

        // Simuler les infos (en réalité, on utiliserait l'API Google Maps)
        document.getElementById('routeDistance').textContent = 'Calculé...';
        document.getElementById('routeDuration').textContent = 'Calculé...';

        // Initialiser la carte
        this.initMap();
    }

    initMap() {
        const camp = this.getCurrentCamp();
        if (!camp || !camp.meetingLocation) return;

        const mapDiv = document.getElementById('map');
        if (!this.map) {
            this.map = new google.maps.Map(mapDiv, {
                zoom: 7,
                center: { lat: 46.6, lng: 2.2 }
            });
        }

        // Créer un geocoder
        const geocoder = new google.maps.Geocoder();

        // Chercher les coordonnées des deux points
        const locations = [
            { address: camp.meetingLocation, label: 'RDV' },
            { address: camp.campDestination, label: 'Camping' }
        ];

        let coords = [];
        let completed = 0;

        locations.forEach(loc => {
            geocoder.geocode({ address: loc.address }, (results, status) => {
                completed++;
                if (status === 'OK') {
                    const location = results[0].geometry.location;
                    coords.push({
                        lat: location.lat(),
                        lng: location.lng(),
                        label: loc.label
                    });

                    // Ajouter le marker
                    new google.maps.Marker({
                        position: location,
                        map: this.map,
                        title: loc.address,
                        label: loc.label
                    });
                }

                // Si les deux ont été trouvés, tracer la route
                if (completed === 2 && coords.length === 2) {
                    this.drawRoute(coords[0], coords[1]);
                }
            });
        });
    }

    drawRoute(origin, destination) {
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer();

        directionsRenderer.setMap(this.map);

        directionsService.route(
            {
                origin: origin,
                destination: destination,
                travelMode: google.maps.TravelMode.DRIVING
            },
            (result, status) => {
                if (status === 'OK') {
                    directionsRenderer.setDirections(result);

                    const route = result.routes[0];
                    const leg = route.legs[0];
                    document.getElementById('routeDistance').textContent = leg.distance.text;
                    document.getElementById('routeDuration').textContent = leg.duration.text;
                } else {
                    document.getElementById('routeDistance').textContent = 'Non trouvé';
                    document.getElementById('routeDuration').textContent = 'Non trouvé';
                }
            }
        );
    }

    // ========== TABS ==========
    switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        if (tabName === 'expenses') {
            this.updateExpensePaidByOptions();
            this.renderExpenseParticipants();
        }
    }
}

// Initialiser l'app
window.app = new CampingApp();