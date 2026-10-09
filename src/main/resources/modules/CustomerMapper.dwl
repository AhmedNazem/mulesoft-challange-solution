%dw 2.0

// List item: summary fields only (samples/responses/customers-200.json)
fun toSummary(c) = {
  customerId: c.customerId,
  firstName: c.firstName,
  lastName: c.lastName,
  email: c.email,
  mobileNumber: c.mobileNumber,
  status: c.status
}

// Backend shape (snake_case) -> API contract (samples/responses/customer-200.json)
fun toCustomerDetail(b) = {
  customerId: b.id,
  firstName: b.first_name,
  lastName: b.last_name,
  email: b.email,
  mobileNumber: b.mobile,
  dateOfBirth: b.birth_date,
  address: {
    city: b.address.city,
    country: b.address.country,
    postalCode: b.address.zip
  },
  status: b.state,
  createdAt: b.created
}

// Request body + server-generated fields -> created customer (samples/responses/create-customer-201.json)
// Unknown request fields are ignored on purpose.
fun toCreatedCustomer(req, id, createdAt) = {
  customerId: id,
  firstName: req.firstName,
  lastName: req.lastName,
  email: req.email,
  mobileNumber: req.mobileNumber,
  dateOfBirth: req.dateOfBirth,
  address: if (req.address != null) {
    city: req.address.city,
    country: req.address.country,
    postalCode: req.address.postalCode
  } else null,
  status: "ACTIVE",
  createdAt: createdAt
}
