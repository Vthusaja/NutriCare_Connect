const auth = async () => {
  const res = await fetch("http://localhost:8080/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "dietitian@nutricare.demo", password: "password" })
  });
  console.log(res.status);
  const data = await res.json();
  console.log("LOGIN:", JSON.stringify(data, null, 2));

  if (data.token) {
    const res2 = await fetch("http://localhost:8080/api/v1/workspace/appointments", {
      headers: { "Authorization": `Bearer ${data.token}` }
    });
    console.log("APPT:", res2.status, await res2.text());
  }
};
auth().catch(console.error);
