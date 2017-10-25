export default {
	props: ['options'],
	data: function() {
		return {
			loading: true,
			checkboxWidth: 0,
			checkboxHeight: 0,
			isPressed: false,
			botLoop: null,
			lastCheckedBox: {
				x: 0,
				y: 0
			}
		};
	},
	computed: {
		width: function() {
			return this.$refs.checkboxCanvas.offsetWidth;
			// return window.innerWidth;
		},
		height: function() {
			console.log(this.$refs.checkboxCanvas.offsetHeight);
			return this.$refs.checkboxCanvas.offsetHeight;
			// return window.innerHeight;
		},
		numCheckboxCols: function() {
			if (this.loading) {
				return 0;
			}
			return Math.floor(this.width / this.checkboxWidth);
		},
		numCheckboxRows: function() {
			if (this.loading) {
				return 0;
			}
			return Math.floor(this.height / this.checkboxHeight);
		},
	},
	methods: {
		init: function() {
			this.checkboxWidth = this.$refs.checkboxReference.offsetWidth;
			this.checkboxHeight = this.$refs.checkboxReference.offsetWidth;
			this.loading = false;
		},
		onCheck: function(event) {
			var app = this;
			var target = event.target;
			var isChecked = target.checked;
			var x = parseInt(target.dataset.x, 10);
			var y = parseInt(target.dataset.y, 10);
			app.checkMultiple(x, y, isChecked);
		},
		checkSingleBox: function(x, y, isChecked) {
			var checkbox = document.getElementById('checkbox-'+x+'-'+y);
			if (checkbox) {
				checkbox.checked = isChecked;
			}
		},
		mouseDown: function() {
			this.isPressed = true;
		},
		mouseUp: function() {
			this.isPressed = false;
		},
		mouseOver: function(event) {
			var app = this;
			if (this.isPressed) {
				var x = parseInt(event.target.dataset.x, 10);
				var y = parseInt(event.target.dataset.y, 10);
				this.checkMultiple(x, y, app.options.isAdding);
			}
		},
		mouseLeave: function(event) {
			this.mouseUp();
		},
		checkMultiple: function(x, y, isChecked) {
			var app = this;
			app.checkSingleBox(x, y, isChecked);
			app.lastCheckedBox.x = x;
			app.lastCheckedBox.y = y;
			if (app.options.mirrorMode) {
				app.checkSingleBox(app.numCheckboxCols + 1 - x, app.numCheckboxRows + 1 - y, isChecked);
				app.checkSingleBox(app.numCheckboxCols + 1 - x, y, isChecked);
				app.checkSingleBox(x, app.numCheckboxRows + 1 - y, isChecked);
			}
		},
		startBot: function() {
			var app = this;
			if (!app.botLoop) {
				app.botLoop = setInterval(function() {
					if (app.options.randomBot) {
						var randomX = app.lastCheckedBox.x + app.randomIntFromInterval(-1, 1);
						var randomY = app.lastCheckedBox.y + app.randomIntFromInterval(-1, 1);
						app.checkMultiple(randomX, randomY, app.options.isAdding);
					} else {
						var randomX = app.lastCheckedBox.x + 1;
						var randomY = app.lastCheckedBox.y + 1;
						app.checkMultiple(randomX, randomY, app.options.isAdding);
					}
				}, 50);
			}
		},
		stopBot: function() {
			var app = this;
			clearInterval(app.botLoop);
			app.botLoop = null;
		},
		randomIntFromInterval: function(min,max) {
			return Math.floor(Math.random()*(max-min+1)+min);
		},
		fillAll: function() {
			var app = this;
			for (var y = 0; y < app.numCheckboxRows; y++) {
				for (var x = 0; x < app.numCheckboxCols; x++) {
					app.checkSingleBox(x, y, true);
				}
			}
		},
		clearAll: function() {
			var app = this;
			for (var y = 0; y < app.numCheckboxRows; y++) {
				for (var x = 0; x < app.numCheckboxCols; x++) {
					app.checkSingleBox(x, y, false);
				}
			}
		}
	},
	mounted: function() {
		console.log('mounted');
		this.init();
	},
	watch: {
		'options.runBot': function(value) {
			var app = this;
			if (value) {
				app.startBot();
			} else {
				app.stopBot();
			}
		},
		'options.doFill': function(value) {
			var app = this;
			if (value) {
				app.fillAll();
			} else {
				app.clearAll();
			}
		}
	}
};
