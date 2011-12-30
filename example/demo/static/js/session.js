/*
	This script handles maintaining a session
	When cookies aren't in operation (for example, using the file protocol).
*/
var Session = (function() {
	var session_data = null,
		prefix = "SESSION_",
		settings = {};

	function store(data) {
		localStorage.setItem(prefix + "session", JSON.stringify(data));
	}
	
	function retrieve() {
		var data = localStorage.getItem(prefix + "session");
		session_data = $.parseJSON(data);
	}
	
	function authenticate(kallback) {
		var $form_holder=$("<div>").addClass("session-overlay").css({
			position: "fixed",
			top: 0,
			bottom: 0,
			left: 0,
			right: 0,
			zIndex: 1000,
			background: "rgba(51,51,51,0.75)"
		}).appendTo("body");
		$form.appendTo($form_holder).addClass("session-login-form").css({
			position: "fixed",
			top: 0,
			left: 0,
			margin: "25% 18%",
			font: "x-large sans-serif",
			width: "60%",
			padding: "2%",
			"border-radius": "1em",
			background: "white",
			border: "1px solid yellow",
			zIndex: 2000
		}).show().find('form').submit(function (event){
			var $form = $(this);
			event.stopPropagation();
			event.preventDefault();
			$.ajax({
				type: 'POST',
				url: settings.url,
				data: $(this).serializeArray(),
				success: function (data) {
					session_data = data;
					store(data);
					$form.hide();
					$(".session-overlay").remove();
					if (kallback) {
						kallback();
					}
				},
				error: function (xhr) {
					var error=null,
						$fld=null,
						data=null,
						error_count=0,
						errors=null;
					if (xhr.status === 403) {
						data = $.parseJSON(xhr.responseText);
						errors = data.errors;
						$form.find(".error").remove();
						if (errors) {
							if (errors.__all__) {
								$form.prepend('<div class="error">' + errors.__all__ + '</div>');
								delete errors.__all__;
							}
							for (error in errors) {
								$fld = $form.find('[name="' + error + '"]').parent();
								if ($fld) {
									error_count += 1;
									$fld.append('<div class="error">' + errors[error] + '</div>');
								}
							}
							if (error_count) {
								$form.prepend('<div class="error">Please fix errors below.</div>');
							}
						}
					}
				},
				dataType: 'json'
			});
			return false;
		});
	}
	
	function getSession(callback) {
		var kallback = callback;
		retrieve();
		if (!session_data) {
			$.ajax({
				type: 'GET',
				url: settings.url,
				success: function (data) {
					session_data = data;
					store(data);
					if (kallback) {
						kallback();
					}
				},
				error: function (xhr) {
					var data;
					if (xhr.status === 403) {
						data = $.parseJSON(xhr.responseText);
						if (data && data.form) {
							$form = $("<div>").html(data.form);
						}
						authenticate(callback);
					}
				},
				dataType: 'json' 
			});
		} else {
			kallback();
		}
	}
	
	return {
		init: function (options, callback) {
			$.extend(settings, options);
			getSession(callback);
		},
		login: function(callback) {
			authenticate(callback);
		},
		get_session: function () {
			return session_data
		}
	}

}());