import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Dashboard from './src/screens/Dashboard';
import HistoryScreen from './src/screens/History';
import TitleWithLogo from './src/components/TitleWithLogo';

const Stack = createStackNavigator();

export default function App() {
	return (
		<NavigationContainer>
			<Stack.Navigator
				screenOptions={{
					headerTitleAlign: 'center',           
					headerStyle: { backgroundColor: '#EAF2F7' },
				}}
			>
				<Stack.Screen
					name="Dashboard"
					component={Dashboard}
					options={{
						headerTitle: () => <TitleWithLogo title="Dashboard" size={16}/>,
					}}
				/>
				<Stack.Screen
					name="History"
					component={HistoryScreen}
					options={({ route }) => ({
						headerTitle: () => (
							<TitleWithLogo
								title={route?.params?.label || 'History'}
								size={16}
							/>
						),
					})}
				/>
			</Stack.Navigator>
		</NavigationContainer>
	);
}
