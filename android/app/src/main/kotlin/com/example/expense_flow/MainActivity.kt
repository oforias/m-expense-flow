package com.example.expense_flow

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannels()
    }
    
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NotificationManager::class.java)
            
            // Default channel
            val defaultChannel = NotificationChannel(
                "default",
                "General",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "General notifications"
            }
            
            // Achievement notifications
            val achievementsChannel = NotificationChannel(
                "achievements",
                "Achievements",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Achievement unlock notifications"
                enableVibration(true)
                enableLights(true)
                lightColor = android.graphics.Color.GREEN
            }
            
            // Budget alert notifications
            val budgetAlertsChannel = NotificationChannel(
                "budget_alerts",
                "Budget Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Budget warning and overspending alerts"
                enableVibration(true)
                enableLights(true)
                lightColor = android.graphics.Color.RED
            }
            
            // Streak reminder notifications
            val streakRemindersChannel = NotificationChannel(
                "streak_reminders",
                "Streak Reminders",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Daily streak maintenance reminders"
                enableVibration(false)
                enableLights(true)
                lightColor = android.graphics.Color.YELLOW
            }
            
            // Challenge notifications
            val challengesChannel = NotificationChannel(
                "challenges",
                "Challenges",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Challenge completion notifications"
                enableVibration(true)
                enableLights(true)
                lightColor = android.graphics.Color.BLUE
            }
            
            // Savings goal notifications
            val savingsGoalsChannel = NotificationChannel(
                "savings_goals",
                "Savings Goals",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Savings goal completion notifications"
                enableVibration(true)
                enableLights(true)
                lightColor = android.graphics.Color.GREEN
            }
            
            // Overspending alert notifications
            val overspendingAlertsChannel = NotificationChannel(
                "overspending_alerts",
                "Overspending Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Intelligent overspending detection alerts"
                enableVibration(true)
                enableLights(true)
                lightColor = android.graphics.Color.RED
            }
            
            // Create all channels
            notificationManager.createNotificationChannels(listOf(
                defaultChannel,
                achievementsChannel,
                budgetAlertsChannel,
                streakRemindersChannel,
                challengesChannel,
                savingsGoalsChannel,
                overspendingAlertsChannel
            ))
        }
    }
}
