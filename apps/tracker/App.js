import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from './Screens/Home.js';
import Login from './Screens/Login.js';
import "./global.css";
import Settings from './Screens/Settings.js';
import History from './Screens/History.js';


// Create the navigator
const Stack = createNativeStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false, 
          contentStyle: { backgroundColor: '#f8f9fa' }, // Light background for the app
        }}
      >
        <Stack.Screen name="home" component={Home} />
        <Stack.Screen name="login" component={Login} />
        <Stack.Screen name="settings" component={Settings} />
        <Stack.Screen name="history" component={History} />
        {/* Add other screens here as needed */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;