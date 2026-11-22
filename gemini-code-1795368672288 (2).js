async function seedInitialUsersOnce() {
  const secondaryApp = firebase.apps.find(app => app.name === "Seeder")
    || firebase.initializeApp(firebase.app().options, "Seeder");

  for (const u of INITIAL_USERS) {
    try {
      const email = usernameToEmail(u.username);
      const cred = await secondaryApp.auth().createUserWithEmailAndPassword(email, u.password);
      await firebase.database().ref(`users/${cred.user.uid}`).set({
        fullName: u.fullName,
        username: u.username,
        role: u.role,
        branchId: u.branchId,
        hidden: u.hidden,
        active: u.active
      });
      console.log(`تم إنشاء الحساب: ${u.fullName} (${u.username})`);
      await secondaryApp.auth().signOut();
    } catch (err) {
      console.warn(`تخطي ${u.username}:`, err.message);
    }
  }
  await secondaryApp.delete();
}