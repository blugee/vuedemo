$(document).ready(function() {
  var typingTimer;
  var doneTypingInterval = 1000;

  $('input[data-type-timer]').on('focus blur', function(){
    $(this)
    .removeClass('typing done-typing')
  });
  //on keyup, start the countdown
  $(document).on('keyup', 'input[data-type-timer]', function(e){
    // ignore tab and shift+tab
    if(e.which === 9 || e.which === 16) {
      return;
    }
    var $this = $(this);
    var doneTyping = function() {
      $this.trigger('mcb:donetyping',[$this]);
      $this
        .removeClass('typing')
        .addClass('done-typing')
    }
    $this.addClass('typing');
    clearTimeout(typingTimer);
    if ($this.val) {
      typingTimer = setTimeout(doneTyping, doneTypingInterval);
    }
  });

  $(document).on('change', 'select[data-change]', function(e) {
    var $this = $(this);
    var prop = $this.attr('data-change');
    var value = $this.find('option:selected').val()
    var toSend = {};
    toSend[prop] = value;
    $.ajax({
      url: $this.attr('data-url'),
      type: 'PUT',
      data: toSend,
      dataType: 'json',
      success: function(data) {
        successCallback(data);
      },
      error: function() {
        errorCallback();
        bsAlert('danger','Network error: Unable to update at this time.');
      }
    });
  });

  window.bsAlert = function(type, message) {
    var alertHTML = '<div class="alert alert-'+type+' alert-dismissable"><button type="button" class="close" data-dismiss="alert" aria-hidden="true"><i class="fa fa-times-circle-o"></i></button><span>'+message+'</span></div>';
    $('#alert-placeholder').html(alertHTML);
  }

  $(document).on('change', 'input.active-checkbox[type="checkbox"]', function(e) {
    var $this = $(this);
    var $hiddenField = $this.prev('input[type="hidden"]');
    $hiddenField.prop('disabled', $this.is(':checked'))
  });

  $(document).on('click', 'a[data-method]', function(e) {
    e.preventDefault();
    var $this = $(this);
    var method = $this.data('method').toUpperCase();
    var url = $this.attr('href');
    var csrf = $this.data('csrf');
    bootbox.confirm("Are you sure?", function(result) {
      if(!result) {
        return;
      }
      $.ajax({
        url: url,
        data: {_csrf: csrf},
        type: method,
        success: function(data) {
          if(data.status === 'OK') {
            $this.trigger('mcb:datamethod:ok',[$this,method,url,data]);
            // if it has data-remove and it's true... 
            // Or if they don't have data-remove
            if(($this.data().hasOwnProperty('remove') && 
              $this.data('remove') === 'true') || 
              !$this.data().hasOwnProperty('remove')){
              // find which is closer (if any), a table or ul
              var closestAncestor = $this.closest('table, ul');
              if(closestAncestor.length) {
                if(closestAncestor.get(0).tagName === 'TABLE') {
                  $this.closest('tr').remove();  
                } else if(closestAncestor.get(0).tagName === 'UL') {
                  $this.closest('li').remove();
                }
              }
            }
            bsAlert('success', $this.data('message'));
          } else {
            $this.trigger('mcb:datamethod:bad',[$this,method,url,data]);
            if($this.data().hasOwnProperty('messageServer')) {
              bsAlert('danger', data.message);
            } else {
              bsAlert('danger', $this.data('messageError'));    
            }
          }    
        },
        error: function(data) {
          $this.trigger('mcb:datamethod:error',[$this,method,url,data]);
          bsAlert('danger',$this.data('messageError'));  
        }
      });
    }); 
  });
});