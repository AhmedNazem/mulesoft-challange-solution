%dw 2.0

fun isBlank(v) = isEmpty(trim((v default "") as String))
fun isValidEmail(v) = ((v default "") as String) matches /^[^@\s]+@[^@\s]+\.[^@\s]+$/
fun isValidMobile(v) = ((v default "") as String) matches /^\+[0-9]{8,15}$/

// Returns an array of {field, message}. Empty array means valid. Collects ALL problems.
fun validateCustomer(p) = [
  (if (isBlank(p.firstName)) { field: "firstName", message: "must not be blank" } else null),
  (if (isBlank(p.lastName)) { field: "lastName", message: "must not be blank" } else null),
  (if (isBlank(p.email)) { field: "email", message: "must not be blank" }
   else if (not isValidEmail(p.email)) { field: "email", message: "must be a valid email address" }
   else null),
  (if (isBlank(p.mobileNumber)) { field: "mobileNumber", message: "must not be blank" }
   else if (not isValidMobile(p.mobileNumber)) { field: "mobileNumber", message: "must start with + followed by 8 to 15 digits" }
   else null)
] filter ((e) -> e != null)
