import { Stack } from 'expo-router';
import { verifyInstallation } from 'nativewind';
import "../global.css"
export default function Layout() {
	// verifyInstallation();
	return (
		<Stack
		
			screenOptions={{
				headerStyle: {
					backgroundColor: '#f4511e',
				},
				headerTintColor: '#fff',
				headerTitleStyle: {
					fontWeight: 'bold',
				},
			}}>
			{/* <Stack.Screen name="index" options={{
				title: 'Index',
				headerShown: false,
			}} /> */}
			<Stack.Screen name="login" options={{
				title: 'Login',
				headerShown: false,

			}} />
			<Stack.Screen name="Home" options={{
				title: 'Home',
				headerShown: false,
			}} />
			<Stack.Screen name="BackgroundTaskScreen" options={{
				title: 'Background Task',
				headerShown: false,
			}} />
		</Stack>
	);
}
